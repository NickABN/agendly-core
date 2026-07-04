import { Test, TestingModule } from '@nestjs/testing';
import { GeocoderService } from './geocoder.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GeocoderService', () => {
  let service: GeocoderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeocoderService],
    }).compile();

    service = module.get<GeocoderService>(GeocoderService);
    mockFetch.mockReset();
  });

  it('should return latitude and longitude when Nominatim returns results', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => [{ lat: '19.4326', lon: '-99.1332' }],
    });

    const result = await service.geocode('Ciudad de México');

    expect(result).toEqual({ latitude: 19.4326, longitude: -99.1332 });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org'),
      expect.objectContaining({ headers: { 'User-Agent': 'Agendly/1.0' } }),
    );
  });

  it('should return null when Nominatim returns an empty array', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => [],
    });

    const result = await service.geocode('dirección inexistente xyz123');

    expect(result).toBeNull();
  });

  it('should return null when a network error occurs', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await service.geocode('any address');

    expect(result).toBeNull();
  });

  it('should URL-encode the address in the request', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => [{ lat: '20.9674', lon: '-89.6237' }],
    });

    await service.geocode('Calle 60 Norte, Mérida, Yucatán');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('Calle%2060%20Norte'),
      expect.any(Object),
    );
  });
});
