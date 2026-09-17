import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Clock, TrendingUp, X } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

const RECENT_SEARCHES = ['بيتزا', 'شاورما', 'برجر', 'كنتاكي', 'قهوة'];
const TRENDING_CATEGORIES = [
  { id: '1', name: 'وجبات سريعة', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=200&auto=format&fit=crop' },
  { id: '2', name: 'صحي', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=200&auto=format&fit=crop' },
  { id: '3', name: 'حلى', image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=200&auto=format&fit=crop' },
  { id: '4', name: 'مخبوزات', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=200&auto=format&fit=crop' },
  { id: '5', name: 'مشروبات', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?q=80&w=200&auto=format&fit=crop' },
  { id: '6', name: 'مشاوي', image: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?q=80&w=200&auto=format&fit=crop' },
];

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن مطاعم، وجبات، أو بقالة"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Recent Searches */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>عمليات البحث السابقة</Text>
          </View>
          <View style={styles.chipsContainer}>
            {RECENT_SEARCHES.map((item, index) => (
              <Animated.View key={index} entering={FadeInRight.delay(index * 50)}>
                <TouchableOpacity style={styles.chip}>
                  <Clock size={14} color="#6B7280" style={{ marginRight: 6 }} />
                  <Text style={styles.chipText}>{item}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Trending Categories */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>اكتشف التصنيفات</Text>
            <TrendingUp size={20} color={Colors.light.primary} />
          </View>
          <View style={styles.trendingGrid}>
            {TRENDING_CATEGORIES.map((category, index) => (
              <Animated.View key={category.id} entering={FadeInUp.delay(200 + index * 50)} style={{ width: '48%' }}>
                <TouchableOpacity style={styles.trendingCard}>
                  <Image source={{ uri: category.image }} style={styles.trendingImage} />
                  <Text style={styles.trendingText}>{category.name}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontFamily: 'Tajawal_500Medium',
    fontSize: 15,
    color: '#1F2937',
    textAlign: 'right', // For Arabic
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 14,
    color: '#4B5563',
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  trendingCard: {
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  trendingImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  trendingText: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 15,
    color: Colors.light.primary,
  },
});
