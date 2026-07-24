import logging
from sqlalchemy.orm import Session
from models import Provider, SubscriptionTier, Biller, Studio

logger = logging.getLogger(__name__)

def seed_default_billers(session: Session) -> dict:
    """Seed the database with default billers if missing. Returns a map of biller name -> Biller instance."""
    logger.info("Seeding default billers...")
    default_billers_data = [
        ("CCBill", "https://ccbill.com", "consumersupport@ccbill.com", "1-888-596-9279", "Primary international adult payment gateway."),
        ("Epoch", "https://epoch.com", "billing@epoch.com", "1-800-893-8871", "Global e-commerce payment service provider."),
        ("Vendo Services", "https://vendoservices.com", "support@vendoservices.com", "1-877-327-8341", "Specialized digital content billing solution."),
        ("Verotel", "https://verotel.com", "support@verotel.com", "1-877-873-0550", "High-risk internet payment service provider (IPSP)."),
        ("Segpay", "https://segpay.com", "help@segpay.com", "1-866-567-1500", "Digital payment processing and subscription billing."),
        ("Centrobill", "https://centrobill.com", "support@centrobill.com", "1-844-469-8088", "Global payment processor for high-risk merchants."),
        ("Probiller", "https://probiller.com", "support@probiller.com", "1-855-232-9555", "Main payment processor for Aylo/MindGeek network sites."),
        ("Rocketgate", "https://rocketgate.com", "support@rocketgate.com", "1-702-997-2347", "Enterprise high-risk payment gateway."),
        ("Netbilling", "https://netbilling.com", "support@netbilling.com", "1-888-357-8166", "Merchant account gateway and transaction processing."),
        ("Paxum", "https://paxum.com", "support@paxum.com", "1-866-380-2986", "Global e-wallet and performer payout service."),
        ("Cosmopayment", "https://cosmopayment.com", "support@cosmopayment.com", "+1-954-890-2821", "Direct payroll and financial services provider."),
        ("MojoHost", "https://mojohost.com", "billing@mojohost.com", "1-877-665-6467", "Infrastructure, hosting, and domain billing."),
        ("Aylo Billing", "https://aylobilling.com", "support@aylobilling.com", "1-800-285-8025", "Official billing portal for Aylo network sites."),
        ("CommerceGate", "https://commercegate.com", "support@commercegate.com", "+34-911-309-470", "European high-risk payment gateway."),
        ("Novalnet", "https://novalnet.com", "support@novalnet.de", "+49-89-92306830", "Full-service payment service provider.")
    ]

    biller_map = {}
    for name, url, email, phone, desc in default_billers_data:
        biller = session.query(Biller).filter(Biller.name == name).first()
        if not biller:
            biller = Biller(name=name, url=url, support_email=email, support_phone=phone, description=desc)
            session.add(biller)
            session.flush()
        biller_map[name] = biller
    
    session.commit()
    return biller_map

def seed_default_studios(session: Session):
    """Seed default adult video studios and networks if missing."""
    logger.info("Seeding default studios and networks...")
    
    # 1. Seed Network Parents first
    networks = [
        ("Vixen Media Group", "https://www.vixen.com", "https://www.google.com/s2/favicons?domain=vixen.com&sz=128", "Premier erotic art & glamour production group", ["glamour", "hd", "4k", "network"], True),
        ("Aylo / MindGeek", "https://www.aylo.com", "https://www.google.com/s2/favicons?domain=aylo.com&sz=128", "Global adult entertainment technology & media conglomerate", ["network", "commercial", "gonzo"], True),
        ("Gamma Entertainment", "https://www.gammae.com", "https://www.google.com/s2/favicons?domain=gammae.com&sz=128", "Multinational adult entertainment production house", ["network", "hd", "cinematic"], True),
    ]

    network_map = {}
    for name, url, logo, details, tags, is_net in networks:
        studio = session.query(Studio).filter(Studio.name == name).first()
        if not studio:
            studio = Studio(name=name, url=url, logo_url=logo, details=details, tags=tags, is_network=is_net)
            session.add(studio)
            session.flush()
        network_map[name] = studio

    # 2. Seed Studios
    child_studios = [
        ("Vixen", "Vixen Media Group", "https://www.vixen.com", "https://www.google.com/s2/favicons?domain=vixen.com&sz=128", "High-end glamour erotic cinema", ["glamour", "erotic", "4k"]),
        ("Tushy", "Vixen Media Group", "https://www.tushy.com", "https://www.google.com/s2/favicons?domain=tushy.com&sz=128", "Cinematic anal romance & glamour", ["anal", "glamour", "4k"]),
        ("Blacked", "Vixen Media Group", "https://www.blacked.com", "https://www.google.com/s2/favicons?domain=blacked.com&sz=128", "Premium interracial erotic production", ["interracial", "glamour", "4k"]),
        ("Deeper", "Vixen Media Group", "https://www.deeper.com", "https://www.google.com/s2/favicons?domain=deeper.com&sz=128", "Passionate cinematic romance", ["cinematic", "passion", "4k"]),
        ("Slayed", "Vixen Media Group", "https://www.slayed.com", "https://www.google.com/s2/favicons?domain=slayed.com&sz=128", "All-female glamour & erotic cinema", ["all-girl", "glamour", "4k"]),
        ("Brazzers", "Aylo / MindGeek", "https://www.brazzers.com", "https://www.google.com/s2/favicons?domain=brazzers.com&sz=128", "Iconic hardcore pop-culture gonzo studio", ["parody", "gonzo", "big-budget"]),
        ("Reality Kings", "Aylo / MindGeek", "https://www.realitykings.com", "https://www.google.com/s2/favicons?domain=realitykings.com&sz=128", "Reality & gonzo adult series network", ["gonzo", "reality", "glamour"]),
        ("Digital Playground", "Aylo / MindGeek", "https://www.digitalplayground.com", "https://www.google.com/s2/favicons?domain=digitalplayground.com&sz=128", "Blockbuster narrative feature films", ["blockbuster", "narrative", "feature"]),
        ("Mofos", "Aylo / MindGeek", "https://www.mofos.com", "https://www.google.com/s2/favicons?domain=mofos.com&sz=128", "Amateur & reality gonzo series", ["reality", "gonzo", "amateur"]),
        ("Twistys", "Aylo / MindGeek", "https://www.twistys.com", "https://www.google.com/s2/favicons?domain=twistys.com&sz=128", "Glamour solo & softcore aesthetic studio", ["solo", "glamour", "softcore"]),
        ("Pure Taboo", "Gamma Entertainment", "https://www.puretaboo.com", "https://www.google.com/s2/favicons?domain=puretaboo.com&sz=128", "Dark dramatic narrative series", ["drama", "taboo", "cinematic"]),
        ("Passion HD", "Gamma Entertainment", "https://www.passionhd.com", "https://www.google.com/s2/favicons?domain=passionhd.com&sz=128", "High-definition erotic romance", ["erotic", "glamour", "hd"]),
        ("Evil Angel", None, "https://www.evilangel.com", "https://www.google.com/s2/favicons?domain=evilangel.com&sz=128", "Director-driven hardcore gonzo pioneer", ["gonzo", "anal", "hardcore"]),
        ("Jules Jordan Video", None, "https://www.julesjordan.com", "https://www.google.com/s2/favicons?domain=julesjordan.com&sz=128", "High-end hardcore gonzo powerhouse", ["gonzo", "hardcore", "high-end"]),
        ("Naughty America", None, "https://www.naughtyamerica.com", "https://www.google.com/s2/favicons?domain=naughtyamerica.com&sz=128", "Fantasy POV & virtual reality studio", ["fantasy", "pov", "vr"]),
        ("BangBros", None, "https://bangbros.com", "https://www.google.com/s2/favicons?domain=bangbros.com&sz=128", "Florida-based reality gonzo pioneer", ["gonzo", "reality", "florida"]),
        ("Wicked Pictures", None, "https://www.wicked.com", "https://www.google.com/s2/favicons?domain=wicked.com&sz=128", "Couples romance & narrative cinema", ["feature", "couples", "romance"]),
        ("Elegant Angel", None, "https://www.elegantangel.com", "https://www.google.com/s2/favicons?domain=elegantangel.com&sz=128", "Hardcore gonzo & all-girl specialty studio", ["gonzo", "all-girl", "anal"]),
        ("Kink.com", None, "https://www.kink.com", "https://www.google.com/s2/favicons?domain=kink.com&sz=128", "Alternative BDSM, fetish, and bondage studio", ["bdsm", "bondage", "fetish"]),
        ("Girlfriends Films", None, "https://www.girlfriendsfilms.com", "https://www.google.com/s2/favicons?domain=girlfriendsfilms.com&sz=128", "Lesbian romance & narrative cinema", ["all-girl", "lesbian", "romance"]),
        ("TeamSkeet", None, "https://www.teamskeet.com", "https://www.google.com/s2/favicons?domain=teamskeet.com&sz=128", "Comedy & youth gonzo series", ["teen", "comedy", "gonzo"]),
        ("Fake Taxi", None, "https://www.faketaxi.com", "https://www.google.com/s2/favicons?domain=faketaxi.com&sz=128", "UK reality POV series", ["reality", "pov", "uk"]),
        ("Bel Ami", None, "https://www.belamionline.com", "https://www.google.com/s2/favicons?domain=belamionline.com&sz=128", "European gay erotica studio", ["gay", "erotic", "europe"]),
        ("Men.com", None, "https://www.men.com", "https://www.google.com/s2/favicons?domain=men.com&sz=128", "Premier gay gonzo production studio", ["gay", "gonzo", "hd"]),
        ("Sean Cody", None, "https://www.seancody.com", "https://www.google.com/s2/favicons?domain=seancody.com&sz=128", "Solo & bareback gay production studio", ["gay", "bareback", "solo"])
    ]

    for name, parent_name, url, logo, desc, tags in child_studios:
        studio = session.query(Studio).filter(Studio.name == name).first()
        parent = network_map.get(parent_name) if parent_name else None
        if not studio:
            studio = Studio(
                name=name,
                url=url,
                logo_url=logo,
                details=desc,
                tags=tags,
                is_network=False,
                parent_id=parent.id if parent else None
            )
            session.add(studio)

    session.commit()

def seed_default_data(engine):
    """Seed the database with default billers, providers, subscription tiers, and studios if missing."""
    with Session(engine) as session:
        biller_map = seed_default_billers(session)
        seed_default_studios(session)

        try:
            logger.info("Seeding default providers and subscription tiers...")

            # Master Providers Dataset
            providers_data = [
                # Webcam / Live Cams
                ("Chaturbate", "https://chaturbate.com", "{performers}_{title}_{id}", "CCBill", ["hls", "streamlink", "cookies", "api"], "Leading interactive live video webcam community."),
                ("Stripchat", "https://stripchat.com", "{performers}_{title}_{id}", "Epoch", ["hls", "streamlink", "cookies", "api"], "Popular interactive live cam broadcasting platform."),
                ("MyFreeCams", "https://www.myfreecams.com", "{performers}_{title}_{id}", "CCBill", ["hls", "streamlink", "cookies", "api"], "Established adult live webcam platform."),
                ("CamSoda", "https://www.camsoda.com", "{performers}_{title}_{id}", "CCBill", ["hls", "streamlink", "cookies", "api"], "Interactive adult live streaming site with VR support."),
                ("LiveJasmin", "https://www.livejasmin.com", "{performers}_{title}_{id}", "Epoch", ["hls", "cookies", "api"], "High-definition premium live webcam platform."),
                ("Bongacams", "https://bongacams.com", "{performers}_{title}_{id}", "Verotel", ["hls", "streamlink", "cookies"], "Global adult live webcam community."),
                ("Cam4", "https://www.cam4.com", "{performers}_{title}_{id}", "CCBill", ["hls", "streamlink", "cookies"], "International live webcam site."),
                ("Flirt4Free", "https://www.flirt4free.com", "{performers}_{title}_{id}", "CCBill", ["hls", "cookies", "api"], "HD live chat and webcam broadcast site."),

                # Creator Platforms
                ("OnlyFans", "https://onlyfans.com", "{performers}_{title}_{id}", "CCBill", ["cookies", "api"], "Creator subscription & pay-per-view platform."),
                ("Fansly", "https://fansly.com", "{performers}_{title}_{id}", "Verotel", ["cookies", "api"], "Fan subscription & exclusive content site."),
                ("ManyVids", "https://www.manyvids.com", "{title}_{performers}_{id}", "CCBill", ["cookies", "direct", "api"], "Independent creator store and video clip marketplace."),
                ("LoyalFans", "https://www.loyalfans.com", "{performers}_{title}_{id}", "CCBill", ["cookies", "api"], "Social creator membership and video site."),
                ("Clips4Sale", "https://www.clips4sale.com", "{studio}_{title}_{id}", "CCBill", ["cookies", "direct"], "Digital clip store marketplace."),
                ("IWantClips", "https://iwantclips.com", "{performers}_{title}_{id}", "CCBill", ["cookies", "direct"], "Independent performer clip shop."),

                # Tube / Free Sites
                ("Pornhub", "https://www.pornhub.com", "{title}_{id}", "Probiller", ["yt-dlp", "direct"], "World's largest free tube site."),
                ("XVideos", "https://www.xvideos.com", "{title}_{id}", "Verotel", ["yt-dlp", "direct"], "Global tube site."),
                ("XNXX", "https://www.xnxx.com", "{title}_{id}", "Verotel", ["yt-dlp", "direct"], "High-volume free tube site."),
                ("YouPorn", "https://www.youporn.com", "{title}_{id}", "Probiller", ["yt-dlp", "direct"], "Major tube streaming site."),
                ("RedTube", "https://www.redtube.com", "{title}_{id}", "Probiller", ["yt-dlp", "direct"], "Popular tube platform."),
                ("SpankBang", "https://spankbang.com", "{title}_{id}", "Centrobill", ["yt-dlp", "direct"], "HD video tube platform."),
                ("Erome", "https://www.erome.com", "{title}_{id}", "CCBill", ["yt-dlp", "direct"], "Album and video sharing platform."),

                # Premium Networks
                ("Brazzers", "https://www.brazzers.com", "{title}_{performers}", "Probiller", ["cookies", "direct"], "Flagship commercial hardcore network."),
                ("Evil Angel", "https://www.evilangel.com", "{title}_{performers}", "CCBill", ["cookies", "direct", "api"], "Gonzo & director-driven studio site."),
                ("Reality Kings", "https://www.realitykings.com", "{title}_{performers}", "Probiller", ["cookies", "direct"], "Gonzo reality series platform."),
                ("Naughty America", "https://www.naughtyamerica.com", "{studio}_{title}_{performers}", "CCBill", ["cookies", "direct"], "Fantasy and VR studio network."),
                ("BangBros", "https://bangbros.com", "{title}_{performers}", "Epoch", ["cookies", "direct"], "Gonzo series network."),
                ("Vixen Media Group", "https://www.vixen.com", "{studio}_{title}_{performers}", "CCBill", ["cookies", "direct", "api"], "High-end glamour erotic media group."),
                ("Kink.com", "https://www.kink.com", "{channel}_{title}_{id}", "Epoch", ["cookies", "direct"], "BDSM & alternative fetish network."),
                ("TeamSkeet", "https://www.teamskeet.com", "{site}_{title}_{performers}", "CCBill", ["cookies", "direct"], "Youth comedy series network."),
                ("LegalPorno", "https://www.legalporno.com", "{title}_{performers}", "Vendo Services", ["cookies", "direct"], "Hardcore fetish studio."),
                ("MetArt Network", "https://www.metart.com", "{site}_{model}_{title}", "Segpay", ["cookies", "direct"], "Erotic art photography & video network."),
                ("X-Art", "https://www.x-art.com", "{model}_{title}", "Segpay", ["cookies", "direct"], "Erotic art cinema network."),

                # VR Platforms
                ("SexLikeReal (SLR)", "https://www.sexlikereal.com", "{studio}_{title}_{id}", "Centrobill", ["cookies", "direct", "api"], "Premier VR video streaming platform."),
                ("DeoVR", "https://deovr.com", "{title}_{id}", "Centrobill", ["cookies", "direct", "api"], "Virtual reality video player & platform."),
                ("WankzVR", "https://www.wankzvr.com", "{title}_{performers}", "Probiller", ["cookies", "direct"], "Virtual reality adult studio."),
                ("BaDoinkVR", "https://badoinkvr.com", "{title}_{performers}", "Probiller", ["cookies", "direct"], "Immersive VR studio site."),

                # General / Local
                ("General", "https://voyarr.local", "{title}", None, ["cookies", "direct", "api"], "Default provider for local media and direct imports.")
            ]

            # Purge dummy fallback Example Provider if present
            session.query(Provider).filter(Provider.name == "Example Provider").delete()
            session.commit()

            seeded_providers = []
            for name, base_url, pattern, biller_name, methods, desc in providers_data:
                biller_inst = biller_map.get(biller_name) if biller_name else None
                provider = session.query(Provider).filter(Provider.name == name).first()
                if not provider:
                    logo = f"https://logo.clearbit.com/{base_url.replace('https://', '').replace('http://', '').replace('www.', '')}"
                    provider = Provider(
                        name=name,
                        base_url=base_url,
                        naming_pattern=pattern,
                        separator="_",
                        space_replacement="_",
                        logo_url=logo,
                        automatic_limits={"daily_downloads": 0},
                        supported_methods=methods,
                        description=desc,
                        default_biller_id=biller_inst.id if biller_inst else None
                    )
                    session.add(provider)
                    session.flush()
                else:
                    # Update biller reference if missing
                    if biller_inst and not provider.default_biller_id:
                        provider.default_biller_id = biller_inst.id
                
                seeded_providers.append(provider)

            session.commit()

            # Seed Subscription Tiers for providers
            tiers_to_add = []
            for provider in seeded_providers:
                existing_tier_count = session.query(SubscriptionTier).filter(SubscriptionTier.provider_id == provider.id).count()
                if existing_tier_count == 0:
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
                    elif provider.name in ["Pornhub", "Chaturbate", "Stripchat", "CamSoda"]:
                        tiers_to_add.extend([
                            SubscriptionTier(provider_id=provider.id, name="Free Member", level=0, price=0.00, features=["standard_stream"]),
                            SubscriptionTier(provider_id=provider.id, name="Premium Subscriber", level=1, price=9.99, features=["hd_stream", "no_ads", "downloads"])
                        ])
                    else:
                        tiers_to_add.extend([
                            SubscriptionTier(provider_id=provider.id, name="Standard Membership", level=1, price=19.99, features=["unlimited_access", "downloads"])
                        ])

            if tiers_to_add:
                session.add_all(tiers_to_add)
                session.commit()

            logger.info("Database seeded successfully with default providers, studios, billers, and subscription tiers!")

        except Exception as e:
            session.rollback()
            logger.error(f"Failed to seed database: {e}")
