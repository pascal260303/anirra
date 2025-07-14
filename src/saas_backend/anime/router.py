# PDM
from fastapi import Query, Depends, APIRouter, HTTPException
from rapidfuzz import fuzz, process
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse

# LOCAL
from saas_backend.utils import to_dict
from saas_backend.anime.utils import get_recommendations, get_user_watched_anime
from saas_backend.auth.models import User, Anime, Watchlist, WatchlistToAnime
from saas_backend.auth.database import get_db
from saas_backend.anime.request_models import UpdateWatchlist
from saas_backend.auth.user_manager.user_manager import UserManager

router = APIRouter(prefix="/anime", tags=["anime"])


@router.get("/search")
async def search_anime(
    query: str, limit: int = 5, offset: int = 0, total_count: bool = False
):
    connection: Session = next(get_db())

    print(f"Searching for {query} with limit {limit} and offset {offset}")

    animes_from_db = connection.query(Anime).all()

    anime_titles = [anime.title for anime in animes_from_db]
    anime_extra_titles = [anime.extra_titles for anime in animes_from_db]

    combined_titles = [
        *anime_titles,
        *[title for titles in anime_extra_titles for title in titles],
    ]

    print("Searching for fuzzy matches")
    results = process.extract(query, combined_titles, scorer=fuzz.ratio, limit=limit)

    results = sorted(results, key=lambda x: x[1], reverse=True)
    results = [result[0] for result in results]

    animes = connection.query(Anime).filter(Anime.title.in_(results)).all()
    extra_animes = (
        connection.query(Anime).filter(Anime.extra_titles.like(f"%{query}%")).all()
    )

    animes = list(
        {anime.title.lower(): anime for anime in [*animes, *extra_animes]}.values()
    )

    if total_count:
        return {
            "animes": [to_dict(anime) for anime in animes][offset : offset + limit],
            "total_count": len(animes),
        }

    return [to_dict(anime) for anime in animes][offset : offset + limit]


@router.get("/search/tags")
async def search_anime_tags(query: str, limit: int = 10, offset: int = 0):
    connection = next(get_db())

    print(f"Searching for {query} with limit {limit} and offset {offset}")

    total_count = (
        connection.query(Anime)
        .filter(Anime.tags.like(f"%{query}%"))
        .filter(Anime.status.notlike("UPCOMING"))
        .count()
    )

    animes_with_tag = (
        connection.query(Anime)
        .filter(Anime.tags.like(f"%{query}%"))
        .filter(Anime.status.notlike("UPCOMING"))
        .order_by(Anime.rating.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total_count": total_count,
        "animes": [to_dict(anime) for anime in animes_with_tag],
    }


@router.get("/recommendations")
async def get_anime_recommendations(
    ids: list[int] = Query(default=[]),
    limit: int = Query(default=10),
    from_watchlist: bool = Query(default=False),
    user: User = Depends(UserManager.get_user_from_header),
    db: Session = Depends(get_db),
):
    watched_anime = get_user_watched_anime(user.id, db)

    return await get_recommendations(
        db,
        limit,
        ids if ids else [anime.id for anime in watched_anime],
        from_watchlist=from_watchlist,
    )


@router.get("/watchlists")
async def get_watchlists(user: User = Depends(UserManager.get_user_from_header)):
    connection = next(get_db())
    watchlist = connection.query(Watchlist).filter(Watchlist.user_id == user.id).first()

    if not watchlist:
        watchlist = Watchlist(user_id=user.id)
        connection.add(watchlist)
        connection.commit()

    watchlist_to_anime = (
        connection.query(WatchlistToAnime)
        .filter(WatchlistToAnime.watchlist_id == watchlist.id)
        .all()
    )

    animes = [
        {"id": anime.anime_id, "status": anime.status, "user_rating": anime.rating}
        for anime in watchlist_to_anime
    ]

    watchlist_animes = (
        connection.query(Anime)
        .filter(Anime.id.in_([anime["id"] for anime in animes]))
        .all()
    )

    # Create a dictionary to map anime IDs to their status
    anime_status_map = {
        anime["id"]: {"status": anime["status"], "user_rating": anime["user_rating"]}
        for anime in animes
    }

    # Include the status in the response
    anime_with_status = [
        {
            **to_dict(anime),
            "watchlist_status": anime_status_map.get(anime.id, {}).get("status"),
            "user_rating": anime_status_map.get(anime.id, {}).get("user_rating"),
        }
        for anime in watchlist_animes
    ]

    return JSONResponse(
        status_code=200,
        content={
            "anime": anime_with_status,
            "user_id": user.id,
            "watchlist_id": watchlist.id if watchlist else None,
        },
    )


@router.put("/watchlists")
async def update_watchlists(
    request: UpdateWatchlist, user: User = Depends(UserManager.get_user_from_header)
):
    connection = next(get_db())

    watchlist = connection.query(Watchlist).filter(Watchlist.user_id == user.id).first()

    if not watchlist:
        new_watchlist = Watchlist(user_id=user.id)
        connection.add(new_watchlist)
        connection.commit()  # Commit to ensure the new watchlist has an ID
        watchlist = new_watchlist

    if request.request == "update":
        for anime in request.anime:
            anime_to_watchlist = (
                connection.query(WatchlistToAnime)
                .filter(
                    WatchlistToAnime.watchlist_id == watchlist.id,
                    WatchlistToAnime.anime_id == anime,
                )
                .first()
            )  #

            if anime_to_watchlist:
                anime_to_watchlist.status = request.status  # type: ignore
            else:
                anime_to_watchlist = WatchlistToAnime(
                    watchlist_id=watchlist.id, anime_id=anime, status=request.status
                )
                connection.add(anime_to_watchlist)

    connection.commit()
    connection.close()

    return JSONResponse(status_code=200, content={"message": "Watchlist updated"})


@router.delete("/watchlists")
async def delete_watchlist_entry(
    anime_id: int,
    _: User = Depends(UserManager.get_user_from_header),
):
    connection = next(get_db())
    watchlist_to_anime = (
        connection.query(WatchlistToAnime)
        .filter(WatchlistToAnime.anime_id == anime_id)
        .first()
    )

    if not watchlist_to_anime:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")

    connection.delete(watchlist_to_anime)
    connection.commit()

    return JSONResponse(status_code=200, content={"message": "Watchlist entry deleted"})


@router.get("/stats")
async def get_anime_stats(user: User = Depends(UserManager.get_user_from_header)):
    connection = next(get_db())
    watchlist = connection.query(Watchlist).filter(Watchlist.user_id == user.id).first()

    if not watchlist:
        return JSONResponse(status_code=404, content={"message": "No watchlist found"})

    # Fetch all anime in the user's watchlist
    watchlist_to_anime = (
        connection.query(WatchlistToAnime)
        .filter(WatchlistToAnime.watchlist_id == watchlist.id)
        .all()
    )

    # Get anime details
    anime_ids = [entry.anime_id for entry in watchlist_to_anime]
    animes = connection.query(Anime).filter(Anime.id.in_(anime_ids)).all()

    # Calculate statistics
    total_anime_watched = len(animes)
    total_length = sum(anime.episode_count for anime in animes)
    average_length = (
        total_length / total_anime_watched if total_anime_watched > 0 else 0
    )

    # Calculate most common genres
    genre_count = {}
    for anime in animes:
        for genre in anime.tags:
            genre_count[genre] = genre_count.get(genre, 0) + 1

    most_common_genres = sorted(genre_count.items(), key=lambda item: item[1], reverse=True)  # type: ignore

    return JSONResponse(
        status_code=200,
        content={
            "total_anime_watched": total_anime_watched,
            "average_length": average_length,
            "most_common_genres": most_common_genres,
        },
    )


@router.get("/rate")
async def rate_anime(
    anime_id: int, rating: int, user: User = Depends(UserManager.get_user_from_header)
):
    connection = next(get_db())
    anime = connection.query(Anime).filter(Anime.id == anime_id).first()

    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")

    watchlist = connection.query(Watchlist).filter(Watchlist.user_id == user.id).first()

    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    watchlist_to_anime = (
        connection.query(WatchlistToAnime)
        .filter(
            WatchlistToAnime.anime_id == anime_id,
            WatchlistToAnime.watchlist_id == watchlist.id,
        )
        .first()
    )

    if not watchlist_to_anime:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")

    watchlist_to_anime.rating = rating  # type: ignore

    connection.commit()

    return JSONResponse(status_code=200, content={"message": "Anime rated"})


@router.get("/{id}")
async def get_anime(id: int):
    connection = next(get_db())
    anime = connection.query(Anime).filter(Anime.id == id).first()

    if anime is None:
        raise HTTPException(status_code=404, detail="Anime not found")

    anime_to_watchlist = (
        connection.query(WatchlistToAnime)
        .filter(WatchlistToAnime.anime_id == id)
        .first()
    )

    if anime_to_watchlist:
        anime.watchlist_status = anime_to_watchlist.status
    else:
        anime.watchlist_status = None

    return anime
