export interface Schedule {
  id?: number;
  user_id: number;
  title: string;
  description?: string;
  due_date: Date | string;
  completed?: boolean;
  document_type?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}
