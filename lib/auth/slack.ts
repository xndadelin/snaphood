'use client'

import { createClient } from "../supabase/client"

export const signInWithSlack = async () => {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "slack_oidc",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_URL}/auth/callback`,
    },
  });
  if (error) {
    throw new Error("Authentication failed");
  }
};