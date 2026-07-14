import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroceryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Grocery Screen (Coming Soon)</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  text: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
});
