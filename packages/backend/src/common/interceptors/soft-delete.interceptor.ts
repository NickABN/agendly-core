import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Filters out soft-deleted records (where deletedAt is not null)
 * from response arrays. Apply to controllers that return Employee or Service lists.
 */
@Injectable()
export class SoftDeleteInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (Array.isArray(data)) {
          return (data as Array<{ deletedAt?: Date | null }>).filter(
            (item) => item.deletedAt === null || item.deletedAt === undefined,
          );
        }
        return data;
      }),
    );
  }
}
