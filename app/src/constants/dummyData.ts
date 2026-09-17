export type FoodCategory = {
  id: string;
  name: string;
  image: string;
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
  { id: '1', name: 'بيتزا', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=300&auto=format&fit=crop' },
  { id: '2', name: 'برجر', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop' },
  { id: '3', name: 'سوشي', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=300&auto=format&fit=crop' },
  { id: '4', name: 'صحي', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=300&auto=format&fit=crop' },
  { id: '5', name: 'قهوة', image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=300&auto=format&fit=crop' },
  { id: '6', name: 'حلويات', image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=300&auto=format&fit=crop' },
];

export const restaurants: Restaurant[] = [
  {
    id: 'r1',
    name: 'بيتزا الثعلب',
    rating: 4.8,
    deliveryTime: '٢٠-٣٠ دقيقة',
    deliveryFee: 15,
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=2940&auto=format&fit=crop',
    categories: ['1', '4'],
    menu: [
      {
        id: 'm1',
        name: 'مارجريتا فوكس',
        description: 'بيتزا كلاسيكية مع الطماطم الطازجة وجبنة الموزاريلا والريحان.',
        price: 90,
        image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=2938&auto=format&fit=crop'
      },
      {
        id: 'm2',
        name: 'بيبروني بليز',
        description: 'بيبروني حار مع كمية إضافية من الجبنة.',
        price: 110,
        image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=2960&auto=format&fit=crop'
      }
    ]
  },
  {
    id: 'r2',
    name: 'برجر تيلز',
    rating: 4.5,
    deliveryTime: '١٥-٢٥ دقيقة',
    deliveryFee: 10,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2930&auto=format&fit=crop',
    categories: ['2'],
    menu: [
      {
        id: 'm3',
        name: 'برجر فوكس كلاسيك',
        description: 'شريحة لحم بقر، خس، طماطم، جبن وصلصة الثعلب الخاصة.',
        price: 75,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=2799&auto=format&fit=crop'
      },
      {
        id: 'm4',
        name: 'دجاج مقرمش',
        description: 'صدر دجاج مقلي، مايونيز ومخلل.',
        price: 85,
        image: 'https://images.unsplash.com/photo-1626082895617-2c6b490f23d4?q=80&w=2834&auto=format&fit=crop'
      }
    ]
  },
  {
    id: 'r3',
    name: 'سوشي فوكس',
    rating: 4.9,
    deliveryTime: '٣٠-٤٥ دقيقة',
    deliveryFee: 20,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=2940&auto=format&fit=crop',
    categories: ['3', '4'],
    menu: [
      {
        id: 'm5',
        name: 'رول السلمون',
        description: 'سلمون طازج مع أفوكادو وخيار.',
        price: 120,
        image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=2825&auto=format&fit=crop'
      },
      {
        id: 'm6',
        name: 'تونا سبايسي',
        description: 'تونة، مايونيز حار، بصل أخضر.',
        price: 135,
        image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=2754&auto=format&fit=crop'
      }
    ]
  }
];
