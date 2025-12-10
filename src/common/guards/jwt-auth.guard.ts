import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<{ isPublic: boolean }>();

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? false;

    // Store isPublic flag in AsyncLocalStorage for use in handleRequest
    // Also store in request object as backup
    const request = context.switchToHttp().getRequest();
    (request as any).__isPublicRoute = isPublic;

    return asyncLocalStorage.run({ isPublic }, () => {
      // For public routes, still try to validate token if present
      // This allows us to get user info for filtering even on public routes
      if (isPublic) {
        // For public routes, catch errors and return true
        // This allows the request to proceed even without a token
        // But we still try to authenticate if a token is present
        const result = super.canActivate(context);
        // Convert to Promise to handle errors
        const promise = Promise.resolve(result);
        return promise.catch(() => {
          // If authentication fails (no token or invalid token), 
          // set user to undefined and allow request to proceed
          request.user = undefined;
          return true;
        }) as Promise<boolean>;
      }
      
      return super.canActivate(context);
    });
  }

  override handleRequest(err: unknown, user: any) {
    // Get isPublic flag from AsyncLocalStorage
    const store = asyncLocalStorage.getStore();
    const isPublic = store?.isPublic ?? false;

    // For public routes, don't throw error if token is missing or invalid
    if (isPublic) {
      // Return user if valid, otherwise return undefined (no error)
      return user || undefined;
    }

    // For protected routes, throw error if token is missing or invalid
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
}
