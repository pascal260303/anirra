import { getJwt } from "@/lib/utils";

import { GetServerSidePropsContext, NextApiRequest } from "next";

export default async function GetServerSideProps(
  context: GetServerSidePropsContext
) {
  const jwt = await getJwt(context.req as NextApiRequest);

  if (!jwt) {
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
    `${
      process.env.API_URL || "http://127.0.0.1:8000"
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
