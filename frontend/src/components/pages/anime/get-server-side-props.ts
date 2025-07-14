import { getJwt } from "@/lib/utils";
import { GetServerSidePropsContext, NextApiRequest } from "next";

export default async function GetServerSideProps(
  context: GetServerSidePropsContext
) {
  const jwt = await getJwt(context.req as NextApiRequest);

  if (!jwt) {
    return {
      props: {
        anime: {},
        description: "",
        watchlistStatus: "",
      },
    };
  }

  const anime = await fetch(
    `${process.env.API_URL || "http://127.0.0.1:8000"}/anime/${
      context.params?.id
    }`
  );

  const recommendations = await fetch(
    `${
      process.env.API_URL || "http://127.0.0.1:8000"
    }/anime/recommendations?ids=${context.params?.id}&limit=20`,
    {
      headers: { Authorization: `Bearer ${jwt.access_token}` },
    }
  );

  const recommendationsData = await recommendations.json();

  const animeData = await anime.json();

  const res = await fetch(
    `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(
      animeData.title
    )}&limit=1`
  );

  const aniListResponse = await res.json();
  const aniListData = aniListResponse.data?.[0] || null;

  if (anime.status === 401) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  return {
    props: {
      anime: { ...animeData, recommendations: recommendationsData },
      description: aniListData ? aniListData?.synopsis : null,
      watchlistStatus: animeData.watchlist_status,
    },
  };
}
