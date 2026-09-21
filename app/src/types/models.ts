// Central type definitions for the FoxShop customer app
// All data is fetched from the backend — no mock data here.

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
  description?: string;
  rating: number;
  ratingCount?: number;
  deliveryTime: string;
  deliveryFee: number;
  image: string;
  isBusy?: boolean;
  distanceKm?: number | null;
};
