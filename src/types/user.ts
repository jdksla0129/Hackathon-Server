export interface User {
  id?: number;
  google_id: string;
  email: string;
  name: string;
  picture?: string;
  created_at?: Date;
  updated_at?: Date;
}
