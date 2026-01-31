import { createClient } from '@supabase/supabase-js';

export default function Home() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  console.log('Supabase connected:', !!supabase);
  return <div>Hello Digital Second Brain!</div>;
}