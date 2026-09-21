import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { Camera, User, X, Check, AlertCircle } from 'lucide-react-native';
import { normalizeMediaUrl } from '../utils/media';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose }) => {
  const { colors } = useThemeStore();
  const { user, updateProfile, isLoading } = useAuthStore();

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUri(url);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      setErrorMsg('الرجاء إدخال الاسم الأول');
      return;
    }

    setErrorMsg(null);
    const formData = new FormData();
    formData.append('first_name', firstName.trim());
    formData.append('last_name', lastName.trim());
    formData.append('phone_number', phone.trim());

    if (selectedFile) {
      formData.append('avatar', selectedFile);
    }

    const res = await updateProfile(formData);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'فشل حفظ التعديلات');
    }
  };

  const currentAvatarUrl = previewUri || (user?.avatar ? normalizeMediaUrl(user.avatar) : null);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.bold }]}>
              تعديل الملف الشخصي
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Web Hidden File Input */}
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef as any}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          )}

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {currentAvatarUrl ? (
                  <Image source={{ uri: currentAvatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight }]}>
                    <User size={48} color={colors.primary} />
                  </View>
                )}

                <TouchableOpacity
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                  style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}
                >
                  <Camera size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handlePickImage} style={styles.changePhotoTextBtn}>
                <Text style={[styles.changePhotoText, { color: colors.primary, fontFamily: Fonts.bold }]}>
                  {currentAvatarUrl ? 'تغيير صورة البروفايل' : 'إضافة صورة شخصية'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {errorMsg && (
              <View style={[styles.errorBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                <AlertCircle size={18} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger, fontFamily: Fonts.medium }]}>
                  {errorMsg}
                </Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                الاسم الأول
              </Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="أدخل الاسم الأول"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.medium,
                  },
                ]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                اسم العائلة
              </Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="أدخل اسم العائلة"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.medium,
                  },
                ]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                رقم الهاتف
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="مثال: 01012345678"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.medium,
                  },
                ]}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={isLoading}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={[styles.saveBtnText, { fontFamily: Fonts.bold }]}>
                    حفظ التغييرات
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    maxHeight: '90%',
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
  },
  content: {
    padding: Spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
    width: 104,
    height: 104,
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  changePhotoTextBtn: {
    marginTop: Spacing.sm,
  },
  changePhotoText: {
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    textAlign: 'right',
    fontSize: 14,
  },
  saveBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: Radius.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
});
