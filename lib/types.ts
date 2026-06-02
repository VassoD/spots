export interface RawPlace {
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  url: string;
  cid: string | null;
  savedDate: string;
  account: string;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  category: string;
  placeType: string;
  rating: number | null;
  priceLevel: string | null;
  city: string;
  arrondissement: number | null;
  country: string;
  lat: number | null;
  lon: number | null;
  url: string;
  savedDate: string;
  accounts: string[];
  visited: boolean;
  seenCount: number;
  lastSeen: string | null;
}

export interface ProcessResult {
  places: Place[];
  accounts: string[];
  enriched: boolean;
  hasActivity: boolean;
  stats: {
    total: number;
    cities: number;
    visited: number;
    byCategory: Record<string, number>;
  };
}
