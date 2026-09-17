import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { ShoppingBag, Search, ShoppingCart, User, UtensilsCrossed } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          borderTopWidth: 0, // removed border for cleaner look
          backgroundColor: '#FFFFFF',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          height: 70 + insets.bottom,
          paddingBottom: 15 + insets.bottom,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontFamily: 'Tajawal_700Bold',
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'طعام',
          tabBarIcon: ({ color }) => <UtensilsCrossed size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="grocery"
        options={{
          title: 'بقالة',
          tabBarIcon: ({ color }) => <ShoppingBag size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'بحث',
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: Colors.light.primary,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: Colors.light.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
              borderWidth: 4,
              borderColor: '#FFFFFF',
              transform: [{ translateY: -25 }],
            }}>
              <Search size={26} color="#FFFFFF" />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={{
              fontSize: 13,
              fontFamily: 'Tajawal_700Bold',
              color: focused ? Colors.light.primary : '#9CA3AF',
              transform: [{ translateY: 5 }],
            }}>
              بحث
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="carts"
        options={{
          title: 'السلة',
          tabBarIcon: ({ color }) => <ShoppingCart size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
