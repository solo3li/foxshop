import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useCartStore } from '../../store/cartStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Minus, Trash2 } from 'lucide-react-native';
import { Colors } from '../../constants/theme';

export default function CartScreen() {
  const router = useRouter();
  const { items, addItem, removeItem, clearCart, getTotalPrice } = useCartStore();
  const subtotal = getTotalPrice();
  const deliveryFee = 15; // Example flat fee
  const total = subtotal + deliveryFee;

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#1F2937" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Cart</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyIcon}>🦊</Text>
          <Text style={styles.emptyText}>Your cart is empty!</Text>
          <Text style={styles.emptySubtext}>Looks like you haven't added any delicious food yet.</Text>
          <TouchableOpacity style={styles.startBrowsingBtn} onPress={() => router.push('/')}>
            <Text style={styles.startBrowsingText}>Start Browsing</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#1F2937" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <TouchableOpacity onPress={clearCart}>
          <Trash2 color="#EF4444" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.itemsList}>
          {items.map((item) => (
            <View key={item.id} style={styles.cartItem}>
              <Image source={{ uri: item.image }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
              </View>
              <View style={styles.quantityControl}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => removeItem(item.id)}>
                  <Minus size={16} color={Colors.light.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => addItem(item)}>
                  <Plus size={16} color={Colors.light.primary} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>${deliveryFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkoutBtn} onPress={() => {
          alert('Order placed successfully! 🦊🍕');
          clearCart();
          router.push('/');
        }}>
          <Text style={styles.checkoutText}>Place Order</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  emptyContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: 'Tajawal_700Bold', color: '#1F2937' },
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 24, fontFamily: 'Tajawal_700Bold', color: '#1F2937', marginBottom: 8 },
  emptySubtext: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32 },
  startBrowsingBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 24 },
  startBrowsingText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Tajawal_700Bold' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  itemsList: { marginBottom: 24 },
  cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: '#FFFFFF' },
  itemImage: { width: 64, height: 64, borderRadius: 12, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontFamily: 'Tajawal_500Medium', color: '#1F2937', marginBottom: 4 },
  itemPrice: { fontSize: 16, fontFamily: 'Tajawal_700Bold', color: Colors.light.primary },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 20, padding: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.light.primaryLight, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 16, fontFamily: 'Tajawal_700Bold', color: '#1F2937', marginHorizontal: 12 },
  summaryContainer: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#4B5563' },
  summaryValue: { fontSize: 14, fontFamily: 'Tajawal_500Medium', color: '#1F2937' },
  totalRow: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', marginBottom: 0 },
  totalLabel: { fontSize: 18, fontFamily: 'Tajawal_700Bold', color: '#1F2937' },
  totalValue: { fontSize: 18, fontFamily: 'Tajawal_700Bold', color: Colors.light.primary },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  checkoutBtn: { backgroundColor: Colors.light.primary, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  checkoutText: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Tajawal_700Bold' }
});
