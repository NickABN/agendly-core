import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DirectoryQueryDto } from './directory-query.dto';

describe('DirectoryQueryDto', () => {
  it('trims q before filtering the directory', async () => {
    const dto = plainToInstance(DirectoryQueryDto, { q: '  Luna  ' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.q).toBe('Luna');
  });

  it('accepts a query at the 80-character boundary', async () => {
    const dto = plainToInstance(DirectoryQueryDto, { q: 'a'.repeat(80) });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a query longer than 80 characters', async () => {
    const dto = plainToInstance(DirectoryQueryDto, { q: 'a'.repeat(81) });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'q')).toBe(true);
  });

  it('allows q to be omitted', async () => {
    const dto = plainToInstance(DirectoryQueryDto, {});

    expect(await validate(dto)).toHaveLength(0);
  });
});
