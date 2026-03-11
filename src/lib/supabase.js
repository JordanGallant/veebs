import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fabujwtmpfviywlaaiva.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TBA3UOwlTnFDw11Y9m9esg__tYUvkLe';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
