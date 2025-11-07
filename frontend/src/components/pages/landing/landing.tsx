import classes from "./landing.module.css";
import { useSession, signIn, getSession } from "next-auth/react";
import useUser from "@/hooks/useUser";
import { Anime } from "@/types/anime.types";
import { Recommendations } from "@/components/shared/recommendations/recommendations";
import Link from "next/link";
import Head from "next/head";
import { useEffect } from "react";
import { SettingsService } from "@/lib/settings-service";

export type LandingProps = {
  stats: {
    total_anime_watched: number;
    average_length: number;
    most_common_genres: string[];
  };
  recommendedAnime?: Array<Anime>;
};

export const Landing = ({ stats, recommendedAnime = [] }: LandingProps) => {
  const { data: session, status } = useSession();
  const { user, updateUser } = useUser();

  // Helper to read runtime-config generated at container start, with fallbacks
  const readHeaderAuthEnabled = () => {
    try {
      // window.__RUNTIME_CONFIG__ is injected by start.sh at container start
      const rc = (globalThis as any)?.__RUNTIME_CONFIG__;
      if (rc && rc.HEADER_AUTH_ENABLED !== undefined) {
        const v = String(rc.HEADER_AUTH_ENABLED || "false");
        return ["1", "true", "yes"].includes(v.toLowerCase());
      }
    } catch { }

    const envVal = (process.env.NEXT_PUBLIC_HEADER_AUTH_ENABLED ?? process.env.HEADER_AUTH_ENABLED ?? "false").toString();
    return ["1", "true", "yes"].includes(envVal.toLowerCase());
  };

  // Auto-login when header authentication is enabled and no session is present
  useEffect(() => {
    const headerAuthEnabled = readHeaderAuthEnabled();

    const doAutoLogin = async () => {
      try {
        const res = await signIn("credentials", {
          redirect: false,
          username: "",
          password: "",
        });

        if (res && !res.error) {
          const s = await getSession();
          const settings = await SettingsService.checkSettings();
          if (s?.user) {
            updateUser({
              username: s.user.username,
              creditBalance: s.user.startingCredits,
              settings,
            });
          }
          // Reload to trigger SSR with authenticated JWT for stats/recommendations
          window.location.reload();
        }
      } catch (e) {
        // ignore – user will see the default landing
      }
    };

    if (headerAuthEnabled && status === "unauthenticated") {
      void doAutoLogin();
    }
  }, [status, updateUser]);

  if (
    !session ||
    !user ||
    (!Object.keys(stats).length && recommendedAnime.length === 0)
  ) {
    return (
      <>
        <Head>
          <title>Anirra</title>
        </Head>
        <div className={classes.notLoggedIn}>
          <h2>Please log in to view your anime dashboard</h2>
          <p>
            Track your anime watching habits and get personalized
            recommendations
          </p>
          {/* Indicator whether frontend read the header-auth env var at build time */}
          <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            {readHeaderAuthEnabled() ? (
              <>
                Header-based authentication is <strong>ENABLED</strong> (frontend runtime config)
              </>
            ) : (
              <>Header-based authentication is <strong>disabled</strong> (frontend runtime config)</>
            )}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Anirra</title>
      </Head>
      <div className={classes.dashboardContainer}>
        <header className={classes.dashboardHeader}>
          <div className={classes.userInfo}>
            <h1>Welcome, {user?.username || "Anime Fan"}</h1>
            <p>Track your anime journey</p>
          </div>
        </header>

        <div className={classes.statsContainer}>
          <div className={classes.statCard}>
            <div className={classes.statIcon}>📺</div>
            <div className={classes.statTitle}>Anime Watched</div>
            <div className={classes.statValue}>{stats.total_anime_watched}</div>
          </div>

          <div className={classes.statCard}>
            <div className={classes.statIcon}>⏱️</div>
            <div className={classes.statTitle}>Average Length</div>
            <div className={classes.statValue}>
              {Math.ceil(stats.average_length)} eps
            </div>
          </div>

          <div className={classes.statCard}>
            <div className={classes.statIcon}>🏷️</div>
            <div className={classes.statTitle}>Top Genres</div>
            <div className={classes.genreListContainer}>
              <ul className={classes.genreList}>
                {stats.most_common_genres.slice(0, 3).map(([genre], index) => (
                  <Link href={`/tag/${genre}`} key={index}>
                    <li key={index} className={classes.genreItem}>
                      {genre}
                    </li>
                  </Link>
                ))}
              </ul>

              <ul className={classes.genreList}>
                {stats.most_common_genres.slice(3, 6).map(([genre], index) => (
                  <Link href={`/tag/${genre}`} key={index}>
                    <li key={index} className={classes.genreItem}>
                      {genre}
                    </li>
                  </Link>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <Recommendations
          recommendedAnime={recommendedAnime}
          className={classes.recommendedSection}
        />
      </div>
    </>
  );
};
