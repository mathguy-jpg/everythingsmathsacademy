/* EMA shared browser integration. Load config.js, Supabase v2 CDN, then this file. */
(() => {
  const cfg = window.EMA_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
    console.warn('EMA: configure Supabase URL/key and load supabase-js v2 first.');
    return;
  }
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  window.EMA = {
    db: client,
    async requireSession(allowedRoles = []) {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) { location.replace('login.html'); return null; }
      const { data: profile, error: pErr } = await client.from('profiles').select('*').eq('id', user.id).single();
      if (pErr || !profile || profile.status !== 'active' || (allowedRoles.length && !allowedRoles.includes(profile.role))) {
        await client.auth.signOut(); location.replace('login.html'); return null;
      }
      window.EMA_PROFILE = profile;
      return profile;
    },
    async signIn(identifier, password) {
      // Supabase Auth signs in by email. For student numbers, resolve the email through a secure RPC.
      let email = identifier.trim();
      if (!email.includes('@')) {
        const { data, error } = await client.rpc('ema_email_for_student_number', { p_student_number: email });
        if (error || !data) throw new Error('Student number not found or account not active.');
        email = data;
      }
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    async signOut() { await client.auth.signOut(); location.replace('login.html'); },
    async getMyResults() {
      const { data, error } = await client.from('assessment_results').select('*, assessments(title, subject, grade, max_score)').order('submitted_at', {ascending:false});
      if (error) throw error; return data || [];
    },
    async listPublishedAssessments(subject, grade) {
      let q = client.from('assessments').select('*').eq('published', true).order('created_at', {ascending:false});
      if (subject) q = q.eq('subject', subject);
      if (grade) q = q.eq('grade', grade);
      const {data,error}=await q; if(error) throw error; return data || [];
    }
  };
})();
