import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Heart, Settings, HelpCircle, MapPin, Ticket, ShoppingBag, ChevronLeft, Crown } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

const MENU_ITEMS = [
  { id: '1', title: 'الطلبات', icon: ShoppingBag, badge: null },
  { id: '2', title: 'القسائم والعروض', icon: Ticket, badge: '٣' },
  { id: '3', title: 'العناوين', icon: MapPin, badge: null },
  { id: '4', title: 'المفضلة', icon: Heart, badge: null },
  { id: '5', title: 'مركز المساعدة', icon: HelpCircle, badge: null },
  { id: '6', title: 'الإعدادات', icon: Settings, badge: null },
];

export default function AccountScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Header */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
          <View style={styles.avatarContainer}>
            <User size={32} color="#FFFFFF" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>أحمد محمد</Text>
            <Text style={styles.userEmail}>ahmed@example.com</Text>
          </View>
        </Animated.View>

        {/* Pro Banner */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.proBanner}>
          <View style={styles.proInfo}>
            <View style={styles.proTitleRow}>
              <Crown size={20} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.proTitle}>panda pro</Text>
            </View>
            <Text style={styles.proSubtitle}>توصيل مجاني، عروض حصرية والمزيد</Text>
          </View>
          <TouchableOpacity style={styles.proBtn}>
            <Text style={styles.proBtnText}>اشترك الآن</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Menu Items */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.menuContainer}>
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity key={item.id} style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.iconContainer}>
                    <Icon size={22} color={Colors.light.primary} />
                  </View>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                </View>
                <View style={styles.menuItemRight}>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                  <ChevronLeft size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Logout Button */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.logoutContainer}>
          <TouchableOpacity style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>تسجيل الخروج</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>الإصدار 1.0.0</Text>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray background to make sections pop
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
  },
  proBanner: {
    margin: 16,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  proInfo: {
    flex: 1,
    marginRight: 16,
  },
  proTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  proTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#FFFFFF',
  },
  proSubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#FCE7F3',
  },
  proBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  proBtnText: {
    color: Colors.light.primary,
    fontFamily: 'Tajawal_700Bold',
    fontSize: 14,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_500Medium',
    color: '#1F2937',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  logoutContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  logoutBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  logoutBtnText: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
  versionText: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#9CA3AF',
  },
});
