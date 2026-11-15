
/* EMA shared browser integration.
   Load config.js, Supabase v2 CDN, then this file.
*/
(() => {
  const cfg = window.EMA_CONFIG || {};

  if (
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    !window.supabase
  ) {
    console.warn(
      'EMA: configure Supabase URL/key and load supabase-js v2 first.'
    );
    return;
  }

  const client = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  window.EMA = {
    db: client,

    // VERIFY LOGGED-IN USER AND LEARNER PROFILE
    async requireSession(allowedRoles = []) {
      const {
        data: { user },
        error
      } = await client.auth.getUser();

      if (error || !user) {
        window.location.replace('login.html');
        return null;
      }

      const {
        data: profile,
        error: pErr
      } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (
        pErr ||
        !profile ||
        profile.status !== 'active' ||
        (
          allowedRoles.length &&
          !allowedRoles.includes(profile.role)
        )
      ) {
        await client.auth.signOut();
        window.location.replace('login.html');
        return null;
      }

      window.EMA_PROFILE = profile;
      return profile;
    },

    // LOGIN USING EMAIL OR LEARNER NUMBER
    async signIn(identifier, password) {
      let email = identifier.trim();

      if (!email.includes('@')) {
        const {
          data,
          error
        } = await client.rpc(
          'ema_email_for_student_number',
          {
            p_student_number: email
          }
        );

        if (error || !data) {
          throw new Error(
            'Student number not found or account not active.'
          );
        }

        email = data;
      }

      const {
        data,
        error
      } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return data;
    },

    // EXISTING FORGOTTEN-PASSWORD EMAIL FUNCTION
    async sendPasswordReset(email) {
      const redirectTo =
        'https://www.everythingsmathsacademy.website/reset-password.html';

      const {
        error
      } = await client.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: redirectTo
        }
      );

      if (error) throw error;
    },

    // SEND VERIFICATION CODE TO THE LOGGED-IN USER'S EMAIL
    async sendPasswordChangeCode() {
      const {
        data,
        error
      } = await client.auth.getUser();

      const user = data?.user;

      if (error || !user || !user.email) {
        throw new Error(
          'Your account email could not be verified. Please log in again.'
        );
      }

      const {
        error: sendError
      } = await client.auth.resetPasswordForEmail(
        user.email
      );

      if (sendError) throw sendError;

      return user.email;
    },

    // VERIFY EMAIL CODE, THEN SAVE THE NEW PASSWORD
    async verifyPasswordChangeCode(token, newPassword) {
      const cleanToken = String(token || '').trim();

      if (!cleanToken || !newPassword) {
        throw new Error(
          'Please enter the verification code and your new password.'
        );
      }

      // Identify the original logged-in account.
      const {
        data: currentData,
        error: currentError
      } = await client.auth.getUser();

      const currentUser = currentData?.user;

      if (
        currentError ||
        !currentUser ||
        !currentUser.email
      ) {
        throw new Error(
          'Your login session has expired. Please log in again.'
        );
      }

      // Verify the recovery code sent to the account email.
      const {
        data: verifiedData,
        error: verifyError
      } = await client.auth.verifyOtp({
        email: currentUser.email,
        token: cleanToken,
        type: 'recovery'
      });

      if (verifyError) {
        throw verifyError;
      }

      // Ensure the verified account is the original account.
      if (
        !verifiedData.user ||
        verifiedData.user.id !== currentUser.id
      ) {
        throw new Error(
          'The verification could not be matched to your account.'
        );
      }

      // Password is changed ONLY after successful verification.
      const {
        data,
        error
      } = await client.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      return data;
    },

    // UPDATE PASSWORD FOR AN AUTHENTICATED USER
    async updatePassword(newPassword) {
      const {
        data,
        error
      } = await client.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return data;
    },

    // LOGOUT
    async signOut() {
      await client.auth.signOut();
      window.location.replace('login.html');
    },

    // GET LEARNER'S ASSESSMENT RESULTS
    async getMyResults() {
      const {
        data,
        error
      } = await client
        .from('assessment_results')
        .select(
          '*, assessments(title, subject, grade, max_score)'
        )
        .order(
          'submitted_at',
          {
            ascending: false
          }
        );

      if (error) throw error;
      return data || [];
    },

    // GET PUBLISHED ASSESSMENTS
    async listPublishedAssessments(subject, grade) {
      let q = client
        .from('assessments')
        .select('*')
        .eq('published', true)
        .order(
          'created_at',
          {
            ascending: false
          }
        );

      if (subject) {
        q = q.eq('subject', subject);
      }

      if (grade) {
        q = q.eq('grade', grade);
      }

      const {
        data,
        error
      } = await q;

      if (error) throw error;
      return data || [];
    }
  };
})();
