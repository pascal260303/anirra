import { getJwt } from "@/lib/utils";

import { GetServerSidePropsContext, NextApiRequest } from "next";

export default async function GetServerSideProps(
  context: GetServerSidePropsContext
) {
  const jwt = await getJwt(context.req as NextApiRequest);

  // If there is no JWT cookie, but header-based auth is enabled and the proxy
  // provided a username header, attempt a server-side header-login so we can
  // set the cookie and then redirect to reload the page with the cookie present.
  if (!jwt) {
    const headerAuthEnabled =
      (process.env.HEADER_AUTH_ENABLED || "false").toString().toLowerCase() in [
        "1",
        "true",
        "yes",
      ];

    if (headerAuthEnabled) {
      const usernameHeaderName =
        process.env.HEADER_AUTH_USERNAME_HEADER || "x-authentik-username";
      const emailHeaderName =
        process.env.HEADER_AUTH_EMAIL_HEADER || "x-authentik-email";

      const incomingHeaders = context.req.headers || {};
      const username = incomingHeaders[usernameHeaderName.toLowerCase()];
      const email = incomingHeaders[emailHeaderName.toLowerCase()];

      if (username) {
        try {
          // Forward the proxy headers to the backend /header-login endpoint
          const backendUrl = `${process.env.API_URL || "http://127.0.0.1:8000"}/header-login`;
          const res = await fetch(backendUrl, {
            method: "POST",
            headers: {
              // preserve header names expected by backend
              [usernameHeaderName]: String(username),
              ...(email ? { [emailHeaderName]: String(email) } : {}),
            },
          });

          const setCookie = res.headers.get("set-cookie");

          if (res.ok && setCookie) {
            // Set cookie on response and redirect so the browser includes it on next request
            context.res.setHeader("Set-Cookie", setCookie);
            return {
              redirect: { destination: context.resolvedUrl || "/", permanent: false },
            };
          }
        } catch (e) {
          // swallow and fall through to unauthenticated props
        }
      }
    }

    return {
      props: {
        stats: {},
        recommendedAnime: [],
      },
    };
  }

  const stats = await fetch(
    `${process.env.API_URL || "http://127.0.0.1:8000"}/anime/stats`,
    {
      headers: {
        Authorization: `Bearer ${jwt.access_token}`,
      },
    }
  );

  const statsData = await stats.json();

  const animeRecommendations = await fetch(
    `${process.env.API_URL || "http://127.0.0.1:8000"
    }/anime/recommendations?limit=20&from_watchlist=true`,
    {
      headers: {
        Authorization: `Bearer ${jwt.access_token}`,
      },
    }
  );

  if (animeRecommendations.status === 401) {
    return {
      redirect: { destination: "/", permanent: false },
    };
  }

  const animeRecommendationsData = await animeRecommendations.json();

  return {
    props: {
      stats: statsData,
      recommendedAnime: animeRecommendationsData,
    },
  };
}
