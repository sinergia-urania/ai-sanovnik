// app.config.js
export default {
  expo: {
    name: "AI Sanovnik",
    slug: "ai-sanovnik",
    scheme: "com.mare82.aisanovnik",
    orientation: "portrait",
    version: "1.0.0",
    plugins: [],
    extra: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    }
  }
};
