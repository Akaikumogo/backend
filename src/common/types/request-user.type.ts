import { AdminRole } from '../constants/roles.enum';

export interface RequestUser {
  id: string;
  email: string;
  role: AdminRole;
  allowedRegions?: string[];
  fullname?: string;
}
