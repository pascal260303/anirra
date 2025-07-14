# PDM
import numpy as np
from sqlalchemy.orm import Session
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

# LOCAL
from saas_backend.auth.models import Anime, Watchlist, AnimeStatus, WatchlistToAnime


async def get_recommendations(
    connection: Session,
    limit: int,
    anime_ids: list[int] = [],
    from_watchlist: bool = False,
    min_rating: int = 4,  # Minimum rating to include in recommendations
):
    # Fetch all anime once
    all_anime = connection.query(Anime).all()

    # Build corpus for TF-IDF
    corpus = [anime.reccomendation_string for anime in all_anime]

    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(corpus)

    # Map Anime.id to TF-IDF matrix row index
    anime_id_to_index = {anime.id: idx for idx, anime in enumerate(all_anime)}

    # Prepare input indices and weights for weighted preference vector
    input_indices = []
    weights = []

    # Collect watchlist ratings in batch if needed
    if from_watchlist and anime_ids:
        # Fetch watchlist entries once
        watchlist_entries = (
            connection.query(WatchlistToAnime)
            .filter(WatchlistToAnime.anime_id.in_(anime_ids))
            .all()
        )

        watchlist_rating_by_id = {
            entry.anime_id: entry.rating for entry in watchlist_entries
        }

        # Filter and weight input anime vectors based on rating threshold
        for anime_id in anime_ids:
            rating = watchlist_rating_by_id.get(anime_id, 0)

            if (rating or 0) < min_rating:
                continue  # exclude low-rated anime from preference vector

            idx = anime_id_to_index.get(anime_id)

            if idx is not None:
                weight = max((rating - 1) / 9.0, 0.01)  # normalize rating to ~0-1
                input_indices.append(idx)
                weights.append(weight)
    else:
        # Not from watchlist — use equal weights
        for anime_id in anime_ids:
            idx = anime_id_to_index.get(anime_id)
            if idx is not None:
                input_indices.append(idx)
                weights.append(1.0)

    if not input_indices:
        return []

    # Get dense vectors of selected input anime
    input_vectors_dense = tfidf_matrix[input_indices].toarray()  # type: ignore
    weights = np.array(weights)

    # Compute weighted mean preference vector
    weighted_mean_vector = np.average(input_vectors_dense, axis=0, weights=weights)

    # Compute similarity between preference vector and all anime
    similarities = cosine_similarity([weighted_mean_vector], tfidf_matrix)[0]  # type: ignore

    # Identify low-rated anime IDs to exclude from recommendations (optional)
    low_rated_ids = set()
    if from_watchlist:
        all_watchlist_entries = (
            connection.query(WatchlistToAnime)
            .filter(WatchlistToAnime.rating < min_rating)
            .all()
        )
        low_rated_ids = {entry.anime_id for entry in all_watchlist_entries}

    # Sort indices by similarity descending, exclude inputs & low-rated anime
    sorted_indices = np.argsort(similarities)[::-1]
    recommended_indices = [
        i
        for i in sorted_indices
        if i not in input_indices and all_anime[i].id not in low_rated_ids  # type: ignore
    ][:limit]

    recommendations = [all_anime[i] for i in recommended_indices]

    return recommendations


def get_user_watched_anime(user_id: int, db: Session):
    result = (
        db.query(Anime)
        .join(WatchlistToAnime, Anime.id == WatchlistToAnime.anime_id)
        .join(Watchlist, Watchlist.id == WatchlistToAnime.watchlist_id)
        .filter(Watchlist.user_id == user_id)
        .filter(WatchlistToAnime.status == AnimeStatus.WATCHED)
        .all()
    )

    return result
