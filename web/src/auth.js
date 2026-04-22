import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";
import { upsertUser } from "@/lib/users";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const dbUser = await upsertUser({
          googleId: profile.sub,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture,
        });
        token.dbUserId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.dbUserId = token.dbUserId;
      return session;
    },
  },
});
