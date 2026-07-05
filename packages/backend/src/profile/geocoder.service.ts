import { Injectable } from '@nestjs/common';

interface NominatimResult {
  lat: string;
  lon: string;
}

@Injectable()
export class GeocoderService {
  async geocode(
    address: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Agendly/1.0' },
      });

      const results = (await response.json()) as NominatimResult[];

      if (!results || results.length === 0) {
        return null;
      }

      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
      };
    } catch {
      return null;
    }
  }
}
