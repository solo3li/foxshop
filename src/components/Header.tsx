import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Search } from 'lucide-react-native';

export const Header: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.locationContainer}>
          <MapPin size={20} color="#FF5A00" />
          <View>
            <Text style={styles.locationLabel}>Delivering to</Text>
            <Text style={styles.locationValue}>Home - 123 Fox Street 🦊</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.profileBtn}>
          <Text style={styles.profileIcon}>🦊</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
        <Text style={styles.searchPlaceholder}>Search for restaurants, food...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 60, // For status bar
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    gap: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: '#FF5A00',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  locationValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    fontSize: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchPlaceholder: {
    color: '#9CA3AF',
    fontSize: 15,
  }
});
