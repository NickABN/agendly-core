import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GeocodeQueryDto } from './geocode-query.dto';

describe('GeocodeQueryDto', () => {
  it('trims the query before geocoding', async () => {
    const dto = plainToInstance(GeocodeQueryDto, { q: '  Av. Reforma 222  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.q).toBe('Av. Reforma 222');
  });

  it('rejects a whitespace-only query', async () => {
    const dto = plainToInstance(GeocodeQueryDto, { q: '   ' });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
