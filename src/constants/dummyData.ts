export type FoodCategory = {
  id: string;
  name: string;
  iconName: string;
};

export type FoodItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
};

export type Restaurant = {
  id: string;
  name: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  image: string;
  categories: string[];
  menu: FoodItem[];
};

export const categories: FoodCategory[] = [
  { id: '1', name: 'Pizza', iconName: 'pizza' },
  { id: '2', name: 'Burger', iconName: 'hamburger' },
  { id: '3', name: 'Sushi', iconName: 'fish' },
  { id: '4', name: 'Healthy', iconName: 'leaf' },
  { id: '5', name: 'Coffee', iconName: 'coffee' },
  { id: '6', name: 'Dessert', iconName: 'cake' },
];

export const restaurants: Restaurant[] = [
  {
    id: 'r1',
    name: 'Fox Pizza',
    rating: 4.8,
    deliveryTime: '20-30 min',
    deliveryFee: 15,
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=2940&auto=format&fit=crop',
    categories: ['1', '4'],
    menu: [
      {
        id: 'm1',
        name: 'Margarita Fox',
        description: 'Classic pizza with fresh tomatoes, mozzarella, and basil.',
        price: 90,
        image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=2938&auto=format&fit=crop'
      },
      {
        id: 'm2',
        name: 'Pepperoni Blaze',
        description: 'Spicy pepperoni with extra cheese.',
        price: 110,
        image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=2960&auto=format&fit=crop'
      }
    ]
  },
  {
    id: 'r2',
    name: 'Burger Tails',
    rating: 4.5,
    deliveryTime: '15-25 min',
    deliveryFee: 10,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2930&auto=format&fit=crop',
    categories: ['2'],
    menu: [
      {
        id: 'm3',
        name: 'Classic Fox Burger',
        description: 'Beef patty, lettuce, tomato, cheese, and special fox sauce.',
        price: 75,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=2799&auto=format&fit=crop'
      },
      {
        id: 'm4',
        name: 'Crispy Chicken',
        description: 'Fried chicken breast, mayo, and pickles.',
        price: 85,
        image: 'https://images.unsplash.com/photo-1626082895617-2c6b490f23d4?q=80&w=2834&auto=format&fit=crop'
      }
    ]
  },
  {
    id: 'r3',
    name: 'Sushi Fox',
    rating: 4.9,
    deliveryTime: '30-45 min',
    deliveryFee: 20,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=2940&auto=format&fit=crop',
    categories: ['3', '4'],
    menu: [
      {
        id: 'm5',
        name: 'Salmon Roll',
        description: 'Fresh salmon with avocado and cucumber.',
        price: 120,
        image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=2825&auto=format&fit=crop'
      },
      {
        id: 'm6',
        name: 'Spicy Tuna',
        description: 'Tuna, spicy mayo, green onion.',
        price: 135,
        image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=2754&auto=format&fit=crop'
      }
    ]
  }
];
