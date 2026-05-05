#!/usr/bin/env python3
"""
Qorix Markets - Auto Social Poster
Posts to X, LinkedIn, Facebook, Instagram, Telegram, Bluesky, Hashnode.
Triggered by GitHub Actions cron 2x daily (9 AM + 7 PM IST).
"""
import json, os, sys, time, base64, hashlib, hmac, secrets, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAPTIONS = json.load(open(os.path.join(ROOT, "scripts/social/captions.json")))
SITE = CAPTIONS["site"]
TAGS_EN = CAPTIONS["default_hashtags_en"]
TAGS_HI = CAPTIONS["default_hashtags_hi"]
BANNERS = CAPTIONS["banners"]

def pick_banner():
    """Rotate banner based on day-of-year + slot (AM/PM)."""
    now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    doy = now.timetuple().tm_yday
    slot = 0 if now.hour < 14 else 1
    idx = ((doy - 1) * 2 + slot) % len(BANNERS)
    return BANNERS[idx]

def img_url(b):
    return f"{SITE}/banners/{b['file']}"

def http(url, method="GET", headers=None, data=None, timeout=60):
    req = urllib.request.Request(url, method=method, headers=headers or {}, data=data)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)

def http_json(url, method="GET", headers=None, payload=None, timeout=60):
    h = dict(headers or {})
    h["Content-Type"] = "application/json"
    body = json.dumps(payload).encode() if payload is not None else None
    return http(url, method, h, body, timeout)

def log(plat, ok, msg):
    icon = "OK" if ok else "FAIL"
    print(f"[{icon}] {plat}: {msg[:200]}")

# -------- TELEGRAM --------
def post_telegram(b):
    tok = os.environ.get("TELEGRAM_BOT_TOKEN")
    chan = os.environ.get("TELEGRAM_CHANNEL_ID")
    if not tok or not chan:
        return log("telegram", False, "missing secrets")
    cap = b["caption_long"] + "\n\n" + TAGS_EN
    if len(cap) > 1024:
        cap = cap[:1020] + "..."
    data = urllib.parse.urlencode({
        "chat_id": chan,
        "photo": img_url(b),
        "caption": cap,
    }).encode()
    code, body = http(
        f"https://api.telegram.org/bot{tok}/sendPhoto",
        "POST",
        {"Content-Type": "application/x-www-form-urlencoded"},
        data,
    )
    log("telegram", code == 200, body)

# -------- BLUESKY --------
def post_bluesky(b):
    handle = os.environ.get("BLUESKY_HANDLE")
    pw = os.environ.get("BLUESKY_APP_PASSWORD")
    if not handle or not pw:
        return log("bluesky", False, "missing secrets")
    code, body = http_json(
        "https://bsky.social/xrpc/com.atproto.server.createSession",
        "POST", payload={"identifier": handle, "password": pw},
    )
    if code != 200:
        return log("bluesky", False, f"auth {code} {body}")
    sess = json.loads(body)
    at, did = sess["accessJwt"], sess["did"]
    img_bytes = urllib.request.urlopen(img_url(b), timeout=60).read()
    code2, body2 = http(
        "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
        "POST",
        {"Authorization": f"Bearer {at}", "Content-Type": "image/png"},
        img_bytes,
    )
    if code2 != 200:
        return log("bluesky", False, f"upload {code2} {body2}")
    blob = json.loads(body2)["blob"]
    text = b["caption_short"]
    if len(text) > 280:
        text = text[:276] + "..."
    rec = {
        "repo": did,
        "collection": "app.bsky.feed.post",
        "record": {
            "$type": "app.bsky.feed.post",
            "text": text,
            "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "embed": {
                "$type": "app.bsky.embed.images",
                "images": [{"alt": b["title"], "image": blob}],
            },
        },
    }
    code3, body3 = http_json(
        "https://bsky.social/xrpc/com.atproto.repo.createRecord",
        "POST", {"Authorization": f"Bearer {at}"}, rec,
    )
    log("bluesky", code3 == 200, body3)

# -------- TWITTER/X (OAuth1.0a media + tweet) --------
def _oauth1_sign(method, url, params, cs, ts):
    p = sorted(params.items())
    qs = "&".join(f"{urllib.parse.quote(k,'')}={urllib.parse.quote(v,'')}" for k, v in p)
    base = f"{method}&{urllib.parse.quote(url,'')}&{urllib.parse.quote(qs,'')}"
    key = f"{urllib.parse.quote(cs,'')}&{urllib.parse.quote(ts,'')}"
    return base64.b64encode(hmac.new(key.encode(), base.encode(), hashlib.sha1).digest()).decode()

def _oauth1_headers(method, url, ck, cs, tk, ts, extra_params=None):
    oauth = {
        "oauth_consumer_key": ck,
        "oauth_nonce": secrets.token_hex(16),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": tk,
        "oauth_version": "1.0",
    }
    sign_params = dict(oauth)
    if extra_params:
        sign_params.update(extra_params)
    oauth["oauth_signature"] = _oauth1_sign(method, url, sign_params, cs, ts)
    auth = "OAuth " + ", ".join(f'{k}="{urllib.parse.quote(v, "")}"' for k, v in oauth.items())
    return {"Authorization": auth}

def post_twitter(b):
    ck = os.environ.get("TWITTER_API_KEY") or os.environ.get("X_API_KEY")
    cs = os.environ.get("TWITTER_API_SECRET") or os.environ.get("X_API_SECRET")
    tk = os.environ.get("TWITTER_ACCESS_TOKEN") or os.environ.get("X_ACCESS_TOKEN")
    ts = os.environ.get("TWITTER_ACCESS_SECRET") or os.environ.get("X_ACCESS_SECRET")
    if not all([ck, cs, tk, ts]):
        return log("twitter", False, "missing secrets")
    img_bytes = urllib.request.urlopen(img_url(b), timeout=60).read()
    boundary = "----QorixBoundary" + secrets.token_hex(8)
    body_parts = []
    body_parts.append(f"--{boundary}\r\n".encode())
    body_parts.append(b'Content-Disposition: form-data; name="media"; filename="img.png"\r\n')
    body_parts.append(b"Content-Type: image/png\r\n\r\n")
    body_parts.append(img_bytes)
    body_parts.append(f"\r\n--{boundary}--\r\n".encode())
    multipart = b"".join(body_parts)
    upload_url = "https://upload.twitter.com/1.1/media/upload.json"
    h = _oauth1_headers("POST", upload_url, ck, cs, tk, ts)
    h["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    code, body = http(upload_url, "POST", h, multipart)
    if code != 200:
        return log("twitter", False, f"media upload {code} {body}")
    media_id = json.loads(body).get("media_id_string")
    text = b["caption_short"]
    if len(text) > 270:
        text = text[:266] + "..."
    tweet_url = "https://api.twitter.com/2/tweets"
    h2 = _oauth1_headers("POST", tweet_url, ck, cs, tk, ts)
    h2["Content-Type"] = "application/json"
    payload = json.dumps({"text": text, "media": {"media_ids": [media_id]}}).encode()
    code2, body2 = http(tweet_url, "POST", h2, payload)
    log("twitter", code2 in (200, 201), body2)

# -------- LINKEDIN --------
def post_linkedin(b):
    tok = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    org_id = os.environ.get("LINKEDIN_ORG_ID")
    person_id = os.environ.get("LINKEDIN_PERSON_ID")
    if not tok:
        return log("linkedin", False, "missing token")
    author = f"urn:li:organization:{org_id}" if org_id else f"urn:li:person:{person_id}" if person_id else None
    if not author:
        return log("linkedin", False, "missing org/person id")
    h = {"Authorization": f"Bearer {tok}", "X-Restli-Protocol-Version": "2.0.0"}
    reg = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": author,
            "serviceRelationships": [{"relationshipType": "OWNER", "identifier": "urn:li:userGeneratedContent"}],
        }
    }
    code, body = http_json("https://api.linkedin.com/v2/assets?action=registerUpload", "POST", h, reg)
    if code != 200:
        return log("linkedin", False, f"register {code} {body}")
    val = json.loads(body)["value"]
    upload_url = val["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
    asset = val["asset"]
    img_bytes = urllib.request.urlopen(img_url(b), timeout=60).read()
    code2, _ = http(upload_url, "POST", {"Authorization": f"Bearer {tok}"}, img_bytes)
    if code2 not in (200, 201):
        return log("linkedin", False, f"upload {code2}")
    text = b["caption_long"] + "\n\n" + TAGS_EN
    post = {
        "author": author,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "IMAGE",
                "media": [{"status": "READY", "description": {"text": b["title"]}, "media": asset, "title": {"text": b["title"]}}],
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    code3, body3 = http_json("https://api.linkedin.com/v2/ugcPosts", "POST", h, post)
    log("linkedin", code3 in (200, 201), body3)

# -------- FACEBOOK --------
def post_facebook(b):
    page_id = os.environ.get("META_PAGE_ID")
    tok = os.environ.get("META_PAGE_ACCESS_TOKEN")
    if not page_id or not tok:
        return log("facebook", False, "missing secrets")
    msg = b["caption_long"] + "\n\n" + TAGS_EN
    data = urllib.parse.urlencode({
        "url": img_url(b),
        "message": msg,
        "access_token": tok,
    }).encode()
    code, body = http(
        f"https://graph.facebook.com/v21.0/{page_id}/photos",
        "POST",
        {"Content-Type": "application/x-www-form-urlencoded"},
        data,
    )
    log("facebook", code == 200, body)

# -------- INSTAGRAM --------
def post_instagram(b):
    ig_id = os.environ.get("META_IG_BUSINESS_ID")
    tok = os.environ.get("META_PAGE_ACCESS_TOKEN")
    if not ig_id or not tok:
        return log("instagram", False, "missing secrets")
    cap = b["caption_long"] + "\n\n" + TAGS_EN
    if len(cap) > 2200:
        cap = cap[:2196] + "..."
    data = urllib.parse.urlencode({
        "image_url": img_url(b),
        "caption": cap,
        "access_token": tok,
    }).encode()
    code, body = http(
        f"https://graph.facebook.com/v21.0/{ig_id}/media",
        "POST",
        {"Content-Type": "application/x-www-form-urlencoded"},
        data,
    )
    if code != 200:
        return log("instagram", False, f"create container {code} {body}")
    creation_id = json.loads(body).get("id")
    time.sleep(5)
    pdata = urllib.parse.urlencode({"creation_id": creation_id, "access_token": tok}).encode()
    code2, body2 = http(
        f"https://graph.facebook.com/v21.0/{ig_id}/media_publish",
        "POST",
        {"Content-Type": "application/x-www-form-urlencoded"},
        pdata,
    )
    log("instagram", code2 == 200, body2)

# -------- HASHNODE --------
def post_hashnode(b):
    tok = os.environ.get("HASHNODE_TOKEN")
    pub = os.environ.get("HASHNODE_PUBLICATION_ID")
    if not tok or not pub:
        return log("hashnode", False, "missing secrets")
    md = f"![{b['title']}]({img_url(b)})\n\n{b['caption_long']}\n\n---\n\n**Get started:** [{SITE}]({SITE})\n\n{TAGS_EN}"
    mutation = """
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) { post { id slug url } }
    }"""
    payload = {
        "query": mutation,
        "variables": {
            "input": {
                "title": b["title"],
                "contentMarkdown": md,
                "publicationId": pub,
                "tags": [
                    {"slug": "ai", "name": "AI"},
                    {"slug": "trading", "name": "Trading"},
                    {"slug": "fintech", "name": "Fintech"},
                ],
                "coverImageOptions": {"coverImageURL": img_url(b)},
            }
        },
    }
    code, body = http_json("https://gql.hashnode.com/", "POST", {"Authorization": tok}, payload)
    log("hashnode", code == 200 and "errors" not in body, body)

PLATFORMS = {
    "telegram": post_telegram,
    "bluesky": post_bluesky,
    "x": post_twitter,
    "twitter": post_twitter,
    "linkedin": post_linkedin,
    "facebook": post_facebook,
    "instagram": post_instagram,
    "hashnode": post_hashnode,
}

def main():
    force_id = os.environ.get("FORCE_BANNER_ID")
    only = os.environ.get("ONLY_PLATFORMS")
    if force_id:
        bnr = next((b for b in BANNERS if b["id"] == force_id), None)
        if not bnr:
            print(f"banner {force_id} not found"); sys.exit(1)
    else:
        bnr = pick_banner()
    print(f"=== Posting banner {bnr['id']}: {bnr['title']} ===")
    plats = [p.strip() for p in only.split(",")] if only else bnr["platforms"]
    print(f"Platforms: {plats}")
    for p in plats:
        fn = PLATFORMS.get(p)
        if not fn:
            log(p, False, "unknown platform")
            continue
        try:
            fn(bnr)
        except Exception as e:
            log(p, False, f"exception: {e}")

if __name__ == "__main__":
    main()
