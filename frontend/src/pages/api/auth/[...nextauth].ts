import NextAuth, { NextAuthOptions, User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import jwt from "jsonwebtoken";

interface ExtendedUser extends NextAuthUser {
  id: string;
  username: string;
}

export const authOptions: NextAuthOptions = {
  secret:
    process.env.NEXTAUTH_SECRET ||
    "cQMmaBUdU4M2i6CcPufbsr+ZJkmtux9wH8Y0ZaxQEKA=",
  session: {
    strategy: "jwt",
  },
  pages: {
    signOut: "/auth/signout",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const loginPath = "/login"; // unified endpoint handles both modes

        const usernameHeaderName =
          process.env.HEADER_AUTH_USERNAME_HEADER || "X-Authentik-Username";
        const emailHeaderName =
          process.env.HEADER_AUTH_EMAIL_HEADER || "X-Authentik-Email";

        const extraHeaders: Record<string, string> = {};
        const incomingHeaders = (req as any)?.headers || {};
        const userHdr = incomingHeaders[usernameHeaderName.toLowerCase()];
        const mailHdr = incomingHeaders[emailHeaderName.toLowerCase()];
        if (userHdr) extraHeaders[usernameHeaderName] = String(userHdr);
        if (mailHdr) extraHeaders[emailHeaderName] = String(mailHdr);

        const response = await fetch(
          `${process.env.API_URL || "http://127.0.0.1:8000"}${loginPath}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              ...extraHeaders,
            },
            // When header-auth enabled backend ignores body and uses proxy headers
            body: new URLSearchParams({
              username: credentials?.username || "",
              password: credentials?.password || "",
            }).toString(),
            credentials: "include",
          }
        );

        if (response.status === 401) {
          throw new Error("Invalid credentials");
        }

        // Prefer JSON body token (backend may return access_token in JSON)
        let access_token: string | undefined;
        try {
          const data = await response.clone().json().catch(() => null);
          access_token = data?.access_token;
        } catch { }
        // Fallback to parsing Set-Cookie
        if (!access_token) {
          access_token = response.headers
            .get("Set-Cookie")
            ?.split(";")[0]
            .split("=")[1];
        }

        if (response.ok && access_token) {
          const decoded = jwt.verify(
            access_token || "",
            process.env.JWT_SECRET ||
            "cQMmaBUdU4M2i6CcPufbsr+ZJkmtux9wH8Y0ZaxQEKA="
          ) as unknown as ExtendedUser;
          return {
            access_token,
            id: decoded.id,
            username: decoded.username,
            startingCredits: (decoded as any).credits,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.access_token = user.access_token;
        token.id = user.id;
        token.username = user.username;
        token.startingCredits = user.startingCredits;
      }

      return token;
    },

    async session({ session, token }) {
      if (token.access_token) {
        session.user = {
          id: token.id as string,
          username: token.username as string,
          startingCredits: token.startingCredits as number,
        };
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
