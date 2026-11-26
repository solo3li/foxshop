import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function RootIndex() {
  const { isAuthenticated, isPendingApproval, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
      </View>
    );
  }

  if (isPendingApproval) {
    return <Redirect href="/auth/pending" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth/login" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});
