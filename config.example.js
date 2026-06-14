/* Optional cloud sync config (V2 §1).

   Copy this file to `config.js` (it is git-ignored so your keys never get
   committed) and fill in your Supabase project values. index.html loads
   `./config.js` before the app boots; if the file is absent or these values are
   empty, sync stays silently disabled and The Blossom works fully offline.

   On a host with env-var injection (Netlify/Vercel) you can instead set
   `window.BLOSSOM_CONFIG` from an injected snippet — sync only reads the global.

   Supabase setup: create a project, then run the SQL in docs/13 §1 to create the
   `blossom_sync` table with row-level security, and enable Anonymous sign-ins
   under Authentication → Providers. */

window.BLOSSOM_CONFIG = {
  supabaseUrl: '',        // e.g. https://your-project.supabase.co
  supabaseAnonKey: '',    // the project's anon/public key (safe for the browser)
  kofiHandle: '',         // optional: your Ko-fi handle to show a Support button
};
