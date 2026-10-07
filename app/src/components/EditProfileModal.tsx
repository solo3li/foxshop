import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { X, User, Mail, Phone, Check } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { EditProfileSvg } from './DiscoveryIcons';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose }) => {
  const { user, updateProfile, isLoading, error, clearError } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (user && visible) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhoneNumber(user.phone_number || '');
      setSuccessMsg(false);
      clearError();
    }
  }, [user, visible, clearError]);

  const handleSave = async () => {
    if (!firstName.trim()) {
      if (Platform.OS === 'web') window.alert('يرجى إدخال الاسم الأول');
      else Alert.alert('تنبيه', 'يرجى إدخال الاسم الأول');
      return;
    }

    const ok = await updateProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone_number: phoneNumber.trim(),
    });

    if (ok) {
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1200);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
            <View style={styles.headerTitleRow}>
              <EditProfileSvg size={20} color="#FF2E7E" />
              <Text style={styles.title}>تعديل الملف الشخصي</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
            {/* Error / Success Banners */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {successMsg && (
              <View style={styles.successBox}>
                <Check size={18} color="#16A34A" />
                <Text style={styles.successText}>تم حفظ التعديلات بنجاح!</Text>
              </View>
            )}

            {/* First Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>الاسم الأول *</Text>
              <View style={styles.inputWrapper}>
                <User size={18} color="#9CA3AF" />
                <TextInput
                  style={[styles.input, { outlineStyle: 'none' } as any]}
                  placeholder="أدخل الاسم الأول"
                  placeholderTextColor="#9CA3AF"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
            </View>

            {/* Last Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>اسم العائلة</Text>
              <View style={styles.inputWrapper}>
                <User size={18} color="#9CA3AF" />
                <TextInput
                  style={[styles.input, { outlineStyle: 'none' } as any]}
                  placeholder="أدخل اسم العائلة"
                  placeholderTextColor="#9CA3AF"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>البريد الإلكتروني</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color="#9CA3AF" />
                <TextInput
                  style={[styles.input, { outlineStyle: 'none' } as any]}
                  placeholder="example@foxshop.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>رقم الجوال</Text>
              <View style={styles.inputWrapper}>
                <Phone size={18} color="#9CA3AF" />
                <TextInput
                  style={[styles.input, { outlineStyle: 'none' } as any]}
                  placeholder="05xxxxxxxx"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlay: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    padding: 20,
    gap: 14,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'right',
  },
  successBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successText: {
    color: '#16A34A',
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#374151',
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#111827',
    textAlign: 'right',
  },
  saveBtn: {
    backgroundColor: '#FF2E7E',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#FF2E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
});
