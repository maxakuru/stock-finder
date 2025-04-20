export type Retailer = 'target' | 'bestbuy' | 'gamestop' | 'walmart';

export interface LookupParams {
  sku: string;
  image?: string;
  title?: string;
  zipcode?: string;
}

export interface PersistedSearchData {
  recent: string[];
  searches: Record<string, Omit<LookupParams, 'zipcode'>>;
}

interface DayTimeMap {
  Monday: string; // eg. "10:00:00.000"
  Tuesday: string;
  Wednesday: string;
  Thursday: string;
  Friday: string;
  Saturday: string;
  Sunday: string;
}

export interface SearchResultLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  timeZoneId: string;
  distance: number;
  openTimesMap?: DayTimeMap;
  closeTimesMap?: DayTimeMap;
}

export interface SearchResultItemLocation {
  locationId: string;
  availability: {
    availablePickupQuantity: number;
  },
  inStoreAvailability: {
    availableInStoreQuantity: number;
  };
  onShelfDisplay?: boolean;
}

export interface SearchResultItem {
  sku: string;
  ispuEligible?: boolean;
  pickupEligible?: boolean;
  inStoreAvailable: boolean;
  inStoreOnly?: boolean;
  locations: SearchResultItemLocation[];
}

export interface SearchResults {
  locations: SearchResultLocation[];
  items: SearchResultItem[];
}