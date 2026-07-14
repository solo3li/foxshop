import { Tabs } from 'expo-router';
import { ShoppingBag, Search, ShoppingCart, User, UtensilsCrossed } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF5A00',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
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
          tabBarIcon: ({ color }) => <Search size={24} color={color} />,
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
