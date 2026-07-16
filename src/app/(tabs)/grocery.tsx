import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingBag, ChevronLeft, Plus } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

const GROCERY_CATEGORIES = [
  { id: '1', name: 'فواكه وخضروات', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=200&auto=format&fit=crop' },
  { id: '2', name: 'ألبان وأجبان', image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?q=80&w=200&auto=format&fit=crop' },
  { id: '3', name: 'لحوم', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?q=80&w=200&auto=format&fit=crop' },
  { id: '4', name: 'مشروبات', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?q=80&w=200&auto=format&fit=crop' },
  { id: '5', name: 'سناكس', image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?q=80&w=200&auto=format&fit=crop' },
];

const GROCERY_PRODUCTS = [
  { id: 'p1', name: 'موز طازج', price: '٢.٥٠', unit: 'كجم', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&q=80' },
  { id: 'p2', name: 'حليب كامل الدسم', price: '٣.٠٠', unit: '١ لتر', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=80' },
  { id: 'p3', name: 'تفاح أحمر', price: '٤.٥٠', unit: 'كجم', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6faa6?w=500&q=80' },
  { id: 'p4', name: 'خبز أسمر', price: '١.٥٠', unit: 'رغيف', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80' },
];

export default function GroceryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <ShoppingBag size={24} color={Colors.light.primary} />
          <Text style={styles.headerTitle}>FoxMart</Text>
        </View>
        <Text style={styles.headerSubtitle}>توصيل في ٢٠ دقيقة</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Banner */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.bannerContainer}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>خصم ٢٠٪</Text>
            <Text style={styles.bannerSubtitle}>على الفواكه الطازجة</Text>
            <TouchableOpacity style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>تسوق الآن</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Categories */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>تسوق حسب القسم</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>الكل</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {GROCERY_CATEGORIES.map((cat, index) => (
              <Animated.View key={cat.id} entering={FadeInRight.delay(index * 50)}>
                <TouchableOpacity style={styles.categoryCard}>
                  <View style={styles.categoryIconContainer}>
                    <Image source={{ uri: cat.image }} style={styles.categoryImage} />
                  </View>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Products Grid */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={[styles.section, { paddingHorizontal: 16 }]}>
          <Text style={styles.sectionTitle}>العروض اليومية</Text>
          <View style={styles.productsGrid}>
            {GROCERY_PRODUCTS.map((product, index) => (
              <Animated.View key={product.id} entering={FadeInUp.delay(300 + index * 50)} style={styles.productCard}>
                <Image source={{ uri: product.image }} style={styles.productImage} />
                <View style={styles.productInfo}>
                  <Text style={styles.productPrice}>{product.price} ر.م</Text>
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.productUnit}>{product.unit}</Text>
                </View>
                <TouchableOpacity style={styles.addBtn}>
                  <Plus size={20} color="#FFFFFF" />
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  bannerContainer: {
    margin: 16,
    height: 140,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#FCE7F3',
  },
  bannerContent: {
    width: '60%',
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_500Medium',
    color: '#831843',
    marginBottom: 12,
  },
  bannerBtn: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  bannerBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Tajawal_700Bold',
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
  categoriesList: {
    flexGrow: 0,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: 16,
    gap: 8,
  },
  categoryIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36, // Make it fully round like the main screen categories
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 13,
    color: '#4B5563',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 16,
  },
  productCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F9FAFB',
  },
  productInfo: {
    padding: 12,
  },
  productPrice: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 16,
    color: Colors.light.primary,
    marginBottom: 4,
  },
  productName: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 2,
  },
  productUnit: {
    fontFamily: 'Tajawal_400Regular',
    fontSize: 12,
    color: '#6B7280',
  },
  addBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: Colors.light.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
