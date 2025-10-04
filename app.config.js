// app.config.js
export default {
  expo: {
    name: "AI Sanovnik",
    slug: "ai-sanovnik",
    scheme: "com.mare82.aisanovnik",
    orientation: "portrait",
    version: "1.0.0",
    extra: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      eas: {
        projectId: "e5abc1e7-6bb5-4c80-bb82-42c30f17d129" // <-- ovo iz poruke
      }
    }
  }
};
