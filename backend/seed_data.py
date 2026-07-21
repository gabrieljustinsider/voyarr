import logging
from sqlalchemy.orm import Session
from models import Provider, SubscriptionTier, Biller

logger = logging.getLogger(__name__)

def seed_default_billers(session: Session):
    """Seed the database with default billers if empty."""
    try:
        existing_count = session.query(Biller).count()
        if existing_count > 0:
            logger.info("Database already seeded with billers. Skipping.")
            return
        
        logger.info("Seeding default billers...")
        default_billers = [
            Biller(name="CCBill", url="https://ccbill.com", support_email="consumersupport@ccbill.com", support_phone="1-888-596-9279", description="CCBill payment gateway."),
            Biller(name="Epoch", url="https://epoch.com", support_email="billing@epoch.com", support_phone="1-800-893-8871", description="Epoch payment services."),
            Biller(name="Vendo", url="https://vendoservices.com", support_email="support@vendoservices.com", support_phone="1-877-327-8341", description="Vendo billing."),
            Biller(name="Verotel", url="https://verotel.com", support_email="support@verotel.com", support_phone="1-877-873-0550", description="Verotel billing gateway."),
            Biller(name="Segpay", url="https://segpay.com", support_email="help@segpay.com", support_phone="1-866-567-1500", description="Segpay payment solutions."),
            Biller(name="Centrobill", url="https://centrobill.com", support_email="support@centrobill.com", support_phone="1-844-469-8088", description="Centrobill safe payments."),
            Biller(name="Probiller", url="https://probiller.com", support_email="support@probiller.com", support_phone="1-855-232-9555", description="Probiller subscription billing services."),
            Biller(name="Rocketgate", url="https://rocketgate.com", support_email="support@rocketgate.com", support_phone="1-702-997-2347", description="Rocketgate high-risk payment gateway."),
            Biller(name="Netbilling", url="https://netbilling.com", support_email="support@netbilling.com", support_phone="1-888-357-8166", description="Netbilling payment processing solutions."),
            Biller(name="Paxum", url="https://paxum.com", support_email="support@paxum.com", support_phone="1-866-380-2986", description="Paxum e-wallet and provider payout services."),
            Biller(name="Cosmopayment", url="https://cosmopayment.com", support_email="support@cosmopayment.com", support_phone="+1-954-890-2821", description="Cosmopayment global payment services."),
            Biller(name="MojoHost", url="https://mojohost.com", support_email="billing@mojohost.com", support_phone="1-877-665-6467", description="MojoHost hosting and infrastructure billing.")
        ]
        session.add_all(default_billers)
        session.commit()
        logger.info("Database successfully seeded with default billers.")
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to seed default billers: {e}")

def seed_default_data(engine):
    """Seed the database with default providers and subscription tiers if empty."""
    with Session(engine) as session:
        seed_default_billers(session)
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
                    supported_methods=["cookies", "direct", "api"]
                ),
                Provider(
                    name="General",
                    base_url="https://voyarr.local",
                    naming_pattern="{title}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://logo.clearbit.com/voyarr.local",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["cookies", "direct", "api"]
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
