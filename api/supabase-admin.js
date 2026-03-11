let cachedClient = null;

async function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase storage credentials are missing.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  cachedClient = createClient(supabaseUrl, supabaseKey);
  return cachedClient;
}

module.exports = {
  getSupabaseAdmin,
};
