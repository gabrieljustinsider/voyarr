import logging
from sqlalchemy import select
from sqlalchemy.orm import Session
from models import Provider, SubscriptionTier

logger = logging.getLogger(__name__)

def seed_default_data(engine):
    """Seed the database with default providers and subscription tiers if empty."""
    with Session(engine) as session:
        try:
            # Check if providers already exist
            existing_providers_count = session.query(Provider).count()
            if existing_providers_count > 0:
                logger.info("Database already seeded with providers. Skipping seeding.")
                return

            logger.info("Empty database detected. Seeding default providers and subscription tiers...")

            # 1. Seed Providers
            default_providers = [
                Provider(
                    name="ManyVids",
                    base_url="https://www.manyvids.com",
                    naming_pattern="{title}_{performers}_{id}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/manyvids.com",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["cookies", "direct", "api"]
                ),
                Provider(
                    name="OnlyFans",
                    base_url="https://onlyfans.com",
                    naming_pattern="{performers}_{title}_{id}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/onlyfans.com",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["cookies", "api"]
                ),
                Provider(
                    name="Fansly",
                    base_url="https://fansly.com",
                    naming_pattern="{performers}_{title}_{id}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/fansly.com",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["cookies", "api"]
                ),
                Provider(
                    name="Pornhub",
                    base_url="https://www.pornhub.com",
                    naming_pattern="{title}_{id}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/pornhub.com",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["yt-dlp", "direct"]
                ),
                Provider(
                    name="XVideos",
                    base_url="https://www.xvideos.com",
                    naming_pattern="{title}_{id}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/xvideos.com",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["yt-dlp", "direct"]
                ),
                Provider(
                    name="LoyalFans",
                    base_url="https://www.loyalfans.com",
                    naming_pattern="{performers}_{title}_{id}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/loyalfans.com",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["cookies", "api"]
                ),
                Provider(
                    name="Brazzers",
                    base_url="https://www.brazzers.com",
                    naming_pattern="{title}_{performers}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/brazzers.com",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["cookies", "direct"]
                ),
                Provider(
                    name="Evil Angel",
                    base_url="https://www.evilangel.com",
                    naming_pattern="{title}_{performers}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/evilangel.com",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["cookies", "direct"]
                )
            ]

            session.add_all(default_providers)
            session.flush() # Flush to populate provider IDs for relationship mapping

            # 2. Seed Subscription Tiers for each seeded provider
            tiers_to_add = []
            for provider in default_providers:
                if provider.name == "ManyVids":
                    tiers_to_add.extend([
                        SubscriptionTier(provider_id=provider.id, name="Free Member", level=0, price=0.00, features=["browse", "preview"]),
                        SubscriptionTier(provider_id=provider.id, name="VIP Club Subscriber", level=1, price=9.99, features=["all_videos", "messages", "downloads"])
                    ])
                elif provider.name in ["OnlyFans", "Fansly", "LoyalFans"]:
                    tiers_to_add.extend([
                        SubscriptionTier(provider_id=provider.id, name="Free Tier (Follower)", level=0, price=0.00, features=["feed_posts"]),
                        SubscriptionTier(provider_id=provider.id, name="Premium Subscriber", level=1, price=14.99, features=["premium_feed", "chat", "downloads"])
                    ])
                elif provider.name == "Pornhub":
                    tiers_to_add.extend([
                        SubscriptionTier(provider_id=provider.id, name="Free Member", level=0, price=0.00, features=["standard_videos"]),
                        SubscriptionTier(provider_id=provider.id, name="Pornhub Premium", level=1, price=9.99, features=["premium_videos", "no_ads", "1080p_4k"])
                    ])
                else:
                    tiers_to_add.extend([
                        SubscriptionTier(provider_id=provider.id, name="Standard Membership", level=1, price=19.99, features=["unlimited_access", "downloads"])
                    ])

            session.add_all(tiers_to_add)
            session.commit()
            logger.info("Database seeded successfully with default providers and subscription tiers!")

        except Exception as e:
            session.rollback()
            logger.error(f"Failed to seed database: {e}")
