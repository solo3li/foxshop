import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { MapPin, Search, Heart, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const Header: React.FC = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Top Location Row */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.locationContainer}>
          <MapPin size={24} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.locationTitle}>Home - 123 Fox Street</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Heart size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#6B7280" style={styles.searchIcon} />
        <TextInput 
          placeholder="Search for shops & restaurants" 
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
          editable={false}
        />
      </View>

      {/* Promo Text */}
      <View style={styles.promoContainer}>
        <Text style={styles.promoTextBold}>
          40% off your 1st pickup order
        </Text>
        <Text style={styles.promoTextBold}>
          code: NEWPICKUP
        </Text>
        <TouchableOpacity style={styles.pickupBtn}>
          <Text style={styles.pickupText}>Pick up now</Text>
          <ChevronRight size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Sheet Indicator */}
      <View style={styles.indicatorContainer}>
        <View style={styles.indicator} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FF5A00',
    paddingHorizontal: 16,
    paddingBottom: 24, 
    position: 'relative',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  promoContainer: {
    marginBottom: 16,
  },
  promoTextBold: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  pickupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  pickupText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  indicator: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  }
});
