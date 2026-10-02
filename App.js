import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Linking,
  Platform,
} from 'react-native';

// ---------------------------------------------
// THEME — bright, Gen Z, high contrast
// ---------------------------------------------
const COLORS = {
  bg: '#FFF9F0',
  card: '#FFFFFF',
  cardBorder: '#2E2145',
  ink: '#1A1330',
  hotPink: '#FF2D95',
  hotPinkSoft: '#FFE1F1',
  electricBlue: '#00C2FF',
  electricBlueSoft: '#DFF6FF',
  violet: '#7B2FFF',
  violetSoft: '#EFE2FF',
  lime: '#B6FF3B',
  limeSoft: '#EEFFCE',
  sunshine: '#FFD93D',
  sunshineSoft: '#FFF6D6',
  green: '#00C97A',
  greenBg: '#DBFFEE',
  red: '#FF3860',
  redBg: '#FFE1E8',
  textSecondary: '#5B5470',
  textMuted: '#8B84A0',
};

const APP_NAME = 'Loot';
const APP_LOGO = '🎒';
const APP_TAGLINE = "level up your money game 🎮";
const STARTING_CASH = 10000;
const XP_PER_TRADE = 20;
const XP_PER_LEVEL = 100;

// ---------------------------------------------
// LEVEL SYSTEM
// ---------------------------------------------
const LEVEL_TITLES = [
  { level: 1, title: 'Beginner', emoji: '🌱' },
  { level: 5, title: 'Learner', emoji: '📘' },
  { level: 10, title: 'Investor', emoji: '💼' },
  { level: 20, title: 'Expert', emoji: '🧠' },
  { level: 50, title: 'Max Wealth', emoji: '👑' },
];

function getLevelFromXp(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}
function getTitleForLevel(level) {
  let current = LEVEL_TITLES[0];
  for (const t of LEVEL_TITLES) {
    if (level >= t.level) current = t;
  }
  return current;
}
function getXpProgress(xp) {
  const level = getLevelFromXp(xp);
  const levelStartXp = (level - 1) * XP_PER_LEVEL;
  const xpIntoLevel = xp - levelStartXp;
  return { level, xpIntoLevel, xpForNext: XP_PER_LEVEL, progress: xpIntoLevel / XP_PER_LEVEL };
}
function parsePrice(priceStr) {
  return parseFloat(String(priceStr).replace(/[^0-9.]/g, '')) || 0;
}
function formatMoney(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------
// LIVE DATA — fetches real price/change/range/volume from
// your deployed backend (see api/quote.js). Falls back to the
// mock numbers in ASSETS if the backend isn't set up yet, or a
// single ticker's fetch fails, so the app never breaks.
//
// 👉 Once you deploy the backend, replace this URL with your
// real Vercel URL, e.g. 'https://loot-backend.vercel.app'
// ---------------------------------------------
const BACKEND_URL = 'https://loot-backend.vercel.app';
const LIVE_DATA_ENABLED = !BACKEND_URL.includes('YOUR-PROJECT-NAME');

async function fetchLiveQuote(ticker) {
  const res = await fetch(`${BACKEND_URL}/api/quote?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error(`Quote fetch failed for ${ticker}`);
  return res.json();
}

// Fetches live quotes for a list of tickers in parallel.
// Returns { liveMap, loading }. liveMap is keyed by ticker;
// any ticker that fails or is still loading just won't be in it,
// so callers should merge with the static ASSETS as a fallback.
function useLiveQuotes(tickers) {
  const [liveMap, setLiveMap] = useState({});
  const [loading, setLoading] = useState(false);
  const tickerKey = tickers.join(',');

  useEffect(() => {
    if (!LIVE_DATA_ENABLED || tickers.length === 0) return;
    let cancelled = false;
    setLoading(true);

    Promise.all(
      tickers.map((t) =>
        fetchLiveQuote(t)
          .then((data) => ({ t, data }))
          .catch(() => ({ t, data: null }))
      )
    ).then((results) => {
      if (cancelled) return;
      const next = {};
      results.forEach(({ t, data }) => {
        if (data) next[t] = data;
      });
      setLiveMap((prev) => ({ ...prev, ...next }));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tickerKey]);

  return { liveMap, loading };
}

// Merges live data (price/change/positive/stats) onto a static
// asset's metadata (name/emoji/blurb/etc). Falls back to the
// static mock numbers if live data isn't available yet.
function withLiveData(asset, liveMap) {
  const live = liveMap[asset.ticker];
  if (!live) return asset;
  return {
    ...asset,
    price: live.price,
    change: live.change,
    positive: live.positive,
    stats: {
      ...asset.stats,
      range: live.stats?.range ?? asset.stats.range,
      volume: live.stats?.volume ?? asset.stats.volume,
      // market cap isn't in the basic quote endpoint yet — keeps mock value for now
    },
  };
}

// ---------------------------------------------
// LOADING SCREEN QUOTES — random funny Gen Z lines
// ---------------------------------------------
const LOADING_QUOTES = [
  "Just hanging around 🐶✋ (hands in pockets, zero worries)",
  "Manifesting your loot rn 💸✨",
  "Bestie, patience is a virtue (unlike your spending) 💅",
  "Loading... no cap, no printer either 🖨️❌",
  "Farming XP in the loading screen 🎮📈",
  "This ain't financial advice, this is just vibes ✨",
  "Bro really said 'let me load' 💀",
  "POV: you're waiting for gains 📈🫠",
  "Respawning your bag 🎒🔥",
  "Currently in my loading-screen era ⏳🔥",
];

// ---------------------------------------------
// VIBE CATEGORIES (curated tabs only)
// ---------------------------------------------
const VIBES = [
  { key: 'trending', label: '🔥 Trending', color: COLORS.hotPink, soft: COLORS.hotPinkSoft },
  { key: 'blueChip', label: '💎 Steady', color: COLORS.electricBlue, soft: COLORS.electricBlueSoft },
  { key: 'dipBuys', label: '📉 On Sale', color: COLORS.violet, soft: COLORS.violetSoft },
];

// ---------------------------------------------
// ASSET DATABASE
// ---------------------------------------------
const ASSETS = {
  NVDA: {
    ticker: 'NVDA', name: 'Nvidia', emoji: '🎮', isIndex: false, category: 'trending',
    price: '$142.80', change: '+5.2%', positive: true, tag: '🚀 HOT',
    blurb: "Everyone's talking about it rn — trading volume is way up.",
    stats: { range: '$136.10 – $144.50', volume: '182M shares', cap: '$3.5T' },
    deepDive: {
      whatsGoingOn: "🎯 Nvidia's stock jumped a good chunk today. Waaay more people are buying and selling it than a normal day — that's what 'high volume' means.",
      whyItMatters: "💡 Big volume + big price move usually means something got people excited (or spooked). Could be news, could be a big investor making a move.",
      shouldYouCare: "🤔 Not a signal to ape in — just means this stock is having a moment. Worth reading up on before doing anything.",
    },
  },
  TSLA: {
    ticker: 'TSLA', name: 'Tesla', emoji: '🚗', isIndex: false, category: 'trending',
    price: '$248.10', change: '+4.1%', positive: true, tag: '⚡ BUZZING',
    blurb: "Lots of news lately, trading activity way up this week.",
    stats: { range: '$239.80 – $250.00', volume: '96M shares', cap: '$790B' },
    deepDive: {
      whatsGoingOn: "🎯 Tesla's price has been swinging more than usual, with a noticeable climb over the past few days.",
      whyItMatters: "💡 Stocks like this that move a lot tend to attract short-term traders, not just long-term holders — that adds to the swings.",
      shouldYouCare: "🤔 High movement = higher risk either direction. Fun to watch, not something to jump into blind.",
    },
  },
  SOFI: {
    ticker: 'SOFI', name: 'SoFi Technologies', emoji: '💸', isIndex: false, category: 'trending',
    price: '$11.65', change: '+7.8%', positive: true, tag: '🔥 HOT',
    blurb: "Blew up on social media, and the numbers back it up.",
    stats: { range: '$10.80 – $11.90', volume: '54M shares', cap: '$12.1B' },
    deepDive: {
      whatsGoingOn: "🎯 This one's had a proper spike today — one of its biggest single-day jumps in a while.",
      whyItMatters: "💡 Smaller companies like this can move way more dramatically than the giant ones, on much less news.",
      shouldYouCare: "🤔 Bigger swings = bigger risk. Cool to keep an eye on, but do your own digging first.",
    },
  },
  AAPL: {
    ticker: 'AAPL', name: 'Apple', emoji: '🍎', isIndex: false, category: 'blueChip',
    price: '$228.40', change: '+0.9%', positive: true, tag: '💎 SOLID',
    blurb: "Doesn't make huge jumps, just quietly climbs.",
    stats: { range: '$226.90 – $229.10', volume: '41M shares', cap: '$3.4T' },
    deepDive: {
      whatsGoingOn: "🎯 Apple barely moved today — small, steady climb, nothing dramatic.",
      whyItMatters: "💡 Low drama usually means big, established investors are holding steady rather than panic-buying or selling.",
      shouldYouCare: "🤔 This is the 'boring but reliable' type of stock. Less exciting, historically less rollercoaster-y too.",
    },
  },
  MSFT: {
    ticker: 'MSFT', name: 'Microsoft', emoji: '🖥️', isIndex: false, category: 'blueChip',
    price: '$441.20', change: '+1.3%', positive: true, tag: '💎 SOLID',
    blurb: "One of the most consistently traded stocks out there.",
    stats: { range: '$437.00 – $442.80', volume: '22M shares', cap: '$3.3T' },
    deepDive: {
      whatsGoingOn: "🎯 A gentle, steady rise today — nothing that stands out as unusual.",
      whyItMatters: "💡 Consistency like this often reflects a company that's just doing fine, quarter after quarter.",
      shouldYouCare: "🤔 Good example of a 'set and forget' type stock, at least based on today's action.",
    },
  },
  ASML: {
    ticker: 'ASML', name: 'ASML Holding', emoji: '🔬', isIndex: false, category: 'blueChip',
    price: '$798.50', change: '+1.6%', positive: true, tag: '💎 SOLID',
    blurb: "Not flashy, been on a slow steady climb for months.",
    stats: { range: '$790.00 – $802.00', volume: '1.2M shares', cap: '$310B' },
    deepDive: {
      whatsGoingOn: "🎯 Another quiet green day, continuing a longer-term upward pattern.",
      whyItMatters: "💡 A steady climb over months (not just one day) tends to mean sustained interest, not a one-off spike.",
      shouldYouCare: "🤔 Worth knowing what the company actually does before assuming 'steady = safe' though — always read up.",
    },
  },
  NKE: {
    ticker: 'NKE', name: 'Nike', emoji: '👟', isIndex: false, category: 'dipBuys',
    price: '$74.20', change: '-3.6%', positive: false, tag: '📉 DOWN',
    blurb: "Rough stretch lately — some see dips as a bargain.",
    stats: { range: '$73.10 – $76.40', volume: '18M shares', cap: '$110B' },
    deepDive: {
      whatsGoingOn: "🎯 Nike's had a noticeable slide today, continuing a rougher few weeks overall.",
      whyItMatters: "💡 A drop like this could be reacting to news, earnings, or just broader sector mood — the data alone doesn't say which.",
      shouldYouCare: "🤔 'On sale' doesn't automatically mean 'good deal' — a falling price can keep falling. Read the news behind it.",
    },
  },
  PYPL: {
    ticker: 'PYPL', name: 'PayPal', emoji: '💳', isIndex: false, category: 'dipBuys',
    price: '$68.90', change: '-2.8%', positive: false, tag: '📉 DOWN',
    blurb: "Pulled back a fair bit, volume picking up near this level.",
    stats: { range: '$67.90 – $70.50', volume: '12M shares', cap: '$71B' },
    deepDive: {
      whatsGoingOn: "🎯 A steady pullback over the past few sessions, with slightly heavier trading today.",
      whyItMatters: "💡 More volume on a down day can mean people are actively deciding whether to buy the dip or bail.",
      shouldYouCare: "🤔 Split opinions usually = more volatility ahead. Not necessarily a red flag, just worth watching.",
    },
  },
  BABA: {
    ticker: 'BABA', name: 'Alibaba', emoji: '🛒', isIndex: false, category: 'dipBuys',
    price: '$85.30', change: '-4.4%', positive: false, tag: '📉 DOWN',
    blurb: "Shaky few weeks. Nobody actually knows what's next.",
    stats: { range: '$83.60 – $88.00', volume: '15M shares', cap: '$205B' },
    deepDive: {
      whatsGoingOn: "🎯 A bigger-than-average drop today, part of a bumpier stretch recently.",
      whyItMatters: "💡 Stocks tied to specific regions or regulations can react hard to local news — worth checking what's driving it.",
      shouldYouCare: "🤔 Higher uncertainty here. Fine to watch, riskier to guess.",
    },
  },
  GOOGL: {
    ticker: 'GOOGL', name: 'Alphabet', emoji: '🔍', isIndex: false, category: null,
    price: '$186.40', change: '+0.6%', positive: true, tag: null,
    blurb: "Fairly calm day, small move up.",
    stats: { range: '$184.90 – $187.20', volume: '19M shares', cap: '$2.3T' },
    deepDive: {
      whatsGoingOn: "🎯 A quiet, small uptick today — nothing out of the ordinary.",
      whyItMatters: "💡 Calm days like this are just normal market noise, not really a story either way.",
      shouldYouCare: "🤔 Nothing screaming for attention here today based on the numbers alone.",
    },
  },
  AMZN: {
    ticker: 'AMZN', name: 'Amazon', emoji: '📦', isIndex: false, category: null,
    price: '$198.70', change: '+1.1%', positive: true, tag: null,
    blurb: "Modest gain today, trading close to normal levels.",
    stats: { range: '$196.30 – $200.10', volume: '28M shares', cap: '$2.1T' },
    deepDive: {
      whatsGoingOn: "🎯 A small, steady gain — trading volume looks close to its usual average.",
      whyItMatters: "💡 Nothing about today's numbers stands out as unusual for this stock.",
      shouldYouCare: "🤔 A pretty ordinary day based on the data alone.",
    },
  },
  META: {
    ticker: 'META', name: 'Meta Platforms', emoji: '📱', isIndex: false, category: null,
    price: '$612.90', change: '-1.4%', positive: false, tag: null,
    blurb: "Small dip today, nothing dramatic in the numbers.",
    stats: { range: '$605.00 – $618.40', volume: '14M shares', cap: '$1.5T' },
    deepDive: {
      whatsGoingOn: "🎯 A modest pullback today, within its usual day-to-day range.",
      whyItMatters: "💡 Small moves like this happen often and don't necessarily mean much on their own.",
      shouldYouCare: "🤔 Nothing here that jumps out as unusual based on today's data.",
    },
  },
  JPM: {
    ticker: 'JPM', name: 'JPMorgan Chase', emoji: '🏦', isIndex: false, category: null,
    price: '$236.10', change: '+0.4%', positive: true, tag: null,
    blurb: "Barely moved today, business as usual.",
    stats: { range: '$234.80 – $237.00', volume: '9M shares', cap: '$680B' },
    deepDive: {
      whatsGoingOn: "🎯 Barely any movement today — a very calm session for this one.",
      whyItMatters: "💡 Big, stable financial stocks like this often trade in a tight range on quiet days.",
      shouldYouCare: "🤔 Nothing notable in today's numbers.",
    },
  },
  SPX: {
    ticker: '^SPX', name: 'S&P 500', emoji: '🇺🇸', isIndex: true, category: null,
    price: '5,634.20', change: '+0.7%', positive: true, tag: null,
    blurb: "Broad US market index, up modestly today.",
    stats: { range: '5,598.10 – 5,640.00', volume: '—', cap: '500 companies' },
    deepDive: {
      whatsGoingOn: "🎯 The S&P 500 tracks 500 of the biggest US companies — today it's up a bit overall.",
      whyItMatters: "💡 When this index moves, it usually reflects how the broader US market is feeling, not just one company.",
      shouldYouCare: "🤔 Good general 'vibe check' for the US market as a whole.",
    },
  },
  IXIC: {
    ticker: '^IXIC', name: 'Nasdaq Composite', emoji: '💻', isIndex: true, category: null,
    price: '19,850.10', change: '+1.2%', positive: true, tag: null,
    blurb: "Tech-heavy index, having a stronger day than most.",
    stats: { range: '19,620.00 – 19,880.50', volume: '—', cap: '3,000+ companies' },
    deepDive: {
      whatsGoingOn: "🎯 This index leans heavily tech — today it's outpacing the broader market.",
      whyItMatters: "💡 Since it's tech-heavy, big moves here often mirror what's happening with major tech stocks.",
      shouldYouCare: "🤔 A decent gauge for 'how is tech doing' specifically.",
    },
  },
  N225: {
    ticker: '^N225', name: 'Nikkei 225', emoji: '🇯🇵', isIndex: true, category: null,
    price: '39,120.50', change: '-0.5%', positive: false, tag: null,
    blurb: "Japan's major index, slightly down today.",
    stats: { range: '38,950.00 – 39,300.00', volume: '—', cap: '225 companies' },
    deepDive: {
      whatsGoingOn: "🎯 A small dip today for this index of major Japanese companies.",
      whyItMatters: "💡 Regional indices like this react to local economic news and currency moves.",
      shouldYouCare: "🤔 Useful if you're curious how the Japanese market's been doing overall.",
    },
  },
};

// ---------------------------------------------
// MOCK DATA — AFFILIATE / PERKS
// ---------------------------------------------
const BROKERAGES = [
  { name: 'Moomoo', emoji: '📈', perk: 'Free stock when you open an account (T&Cs apply)', link: 'https://www.moomoo.com' },
  { name: 'Webull', emoji: '🐂', perk: 'Commission-free trades on US stocks', link: 'https://www.webull.com' },
  { name: 'Robinhood', emoji: '🏹', perk: 'Simple app, no account minimums', link: 'https://www.robinhood.com' },
];

const CREDIT_CARDS = [
  { name: 'CashBack Rewards Card', emoji: '💳', perk: 'Up to 5% cashback on food delivery & subscriptions', link: 'https://example.com/cashback-card' },
  { name: 'Student Travel Card', emoji: '✈️', perk: 'No annual fee, air miles on everyday spend', link: 'https://example.com/travel-card' },
  { name: 'Everyday Spend Card', emoji: '🛍️', perk: 'Flat cashback, zero paperwork signup', link: 'https://example.com/everyday-card' },
];

// ---------------------------------------------
// LEVEL / XP UI PIECES
// ---------------------------------------------
function LevelChip({ xp }) {
  const { level } = getXpProgress(xp);
  const { emoji } = getTitleForLevel(level);
  return (
    <View style={styles.levelChip}>
      <Text style={styles.levelChipText}>{emoji} Lvl {level}</Text>
    </View>
  );
}

function XpBar({ xp }) {
  const { xpIntoLevel, xpForNext, progress } = getXpProgress(xp);
  return (
    <View>
      <View style={styles.xpBarTrack}>
        <View style={[styles.xpBarFill, { width: `${Math.min(progress, 1) * 100}%` }]} />
      </View>
      <Text style={styles.xpBarLabel}>{xpIntoLevel} / {xpForNext} XP to next level</Text>
    </View>
  );
}

// ---------------------------------------------
// ONBOARDING SCREENS
// ---------------------------------------------
function LoadingScreen({ onDone }) {
  const [quote] = useState(() => LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)]);

  useEffect(() => {
    const timer = setTimeout(onDone, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, styles.centerAll]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <Text style={styles.loadingLogo}>{APP_LOGO}</Text>
      <Text style={styles.loadingAppName}>{APP_NAME}</Text>

      <View style={styles.dogBox}>
        <Text style={styles.dogEmoji}>🐕</Text>
        <Text style={styles.dogHands}>🤲</Text>
      </View>

      <Text style={styles.loadingQuote}>{quote}</Text>
    </SafeAreaView>
  );
}

function HomeScreen({ onGuest, onCreateAccount }) {
  return (
    <SafeAreaView style={[styles.safeArea, styles.centerAll]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <Text style={styles.homeLogo}>{APP_LOGO}</Text>
      <Text style={styles.homeAppName}>{APP_NAME}</Text>
      <Text style={styles.homeTagline}>{APP_TAGLINE}</Text>

      <View style={styles.homeCardsRow}>
        <View style={[styles.homeVibeChip, { backgroundColor: COLORS.hotPinkSoft, borderColor: COLORS.hotPink }]}>
          <Text style={styles.homeVibeChipText}>🔥 Trending</Text>
        </View>
        <View style={[styles.homeVibeChip, { backgroundColor: COLORS.electricBlueSoft, borderColor: COLORS.electricBlue }]}>
          <Text style={styles.homeVibeChipText}>💎 Steady</Text>
        </View>
        <View style={[styles.homeVibeChip, { backgroundColor: COLORS.violetSoft, borderColor: COLORS.violet }]}>
          <Text style={styles.homeVibeChipText}>📉 On Sale</Text>
        </View>
      </View>

      <View style={styles.homePerkBox}>
        <Text style={styles.homePerkText}>🎮 Start at Lvl 1 · Beginner and grind XP in Paper Trading</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={onCreateAccount}>
        <Text style={styles.primaryButtonText}>✨ Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7} onPress={onGuest}>
        <Text style={styles.secondaryButtonText}>👀 Just Browsing (Continue as Guest)</Text>
      </TouchableOpacity>

      <Text style={styles.homeFooterText}>No pressure, switch anytime</Text>
    </SafeAreaView>
  );
}

function SignupScreen({ onBack, onSignup }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = name.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.signupContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>⬅️ Back</Text>
        </TouchableOpacity>

        <Text style={styles.signupLogo}>{APP_LOGO}</Text>
        <Text style={styles.signupTitle}>Let's get you set up</Text>
        <Text style={styles.signupSubtitle}>Takes like 10 seconds, promise 🤞</Text>

        <Text style={styles.inputLabel}>What should we call you?</Text>
        <TextInput
          style={styles.textInputField}
          placeholder="Your name"
          placeholderTextColor={COLORS.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.inputLabel}>Email (optional for now)</Text>
        <TextInput
          style={styles.textInputField}
          placeholder="you@email.com"
          placeholderTextColor={COLORS.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.inputLabel}>Password (optional for now)</Text>
        <TextInput
          style={styles.textInputField}
          placeholder="••••••••"
          placeholderTextColor={COLORS.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
          activeOpacity={0.85}
          disabled={!canSubmit}
          onPress={() => onSignup(name.trim())}
        >
          <Text style={styles.primaryButtonText}>🚀 Let's Go</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------
// SHARED COMPONENTS
// ---------------------------------------------
function PercentBadge({ change, positive }) {
  return (
    <View style={[styles.percentBadge, { backgroundColor: positive ? COLORS.greenBg : COLORS.redBg }]}>
      <Text style={[styles.percentBadgeText, { color: positive ? COLORS.green : COLORS.red }]}>
        {positive ? '📈 ' : '📉 '}{change}
      </Text>
    </View>
  );
}

function StockCard({ stock, accentColor, onPress, onRemove, ownedShares }) {
  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: accentColor || COLORS.cardBorder }]}
      activeOpacity={0.8}
      onPress={() => onPress(stock)}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardEmoji}>{stock.emoji}</Text>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.ticker}>{stock.ticker}</Text>
          <Text style={styles.companyName}>{stock.name}</Text>
        </View>
        <PercentBadge change={stock.change} positive={stock.positive} />
      </View>

      <View style={styles.priceTagRow}>
        <Text style={styles.price}>{stock.price}</Text>
        {stock.tag ? (
          <View style={[styles.emojiTag, { backgroundColor: accentColor || COLORS.violet }]}>
            <Text style={styles.emojiTagText}>{stock.tag}</Text>
          </View>
        ) : null}
      </View>

      {ownedShares > 0 ? (
        <Text style={styles.ownedText}>🎒 You own {ownedShares} share{ownedShares === 1 ? '' : 's'}</Text>
      ) : null}

      <Text style={styles.blurbText}>{stock.blurb}</Text>

      <View style={styles.tapHintRow}>
        <Text style={styles.tapHintText}>👉 Tap for the full breakdown</Text>
        {onRemove ? (
          <TouchableOpacity onPress={() => onRemove(stock.ticker)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.removeText}>✕ Remove</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function PerkCard({ item, kind }) {
  const handlePress = () => Linking.openURL(item.link).catch(() => {});
  return (
    <View style={styles.perkCard}>
      <View style={styles.perkTopRow}>
        <Text style={styles.perkEmoji}>{item.emoji}</Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.perkName}>{item.name}</Text>
          <Text style={styles.perkDetail}>{item.perk}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.perkButton} activeOpacity={0.85} onPress={handlePress}>
        <Text style={styles.perkButtonText}>
          {kind === 'brokerage' ? 'Check it out 🚀' : 'See the perks 💳'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.sponsoredTag}>🔗 Affiliate link — totally optional</Text>
    </View>
  );
}

// ---------------------------------------------
// DATA-ONLY STOCK DETAIL SCREEN
// (used from Market / Watchlist — no trading here on purpose)
// ---------------------------------------------
function StockDetailScreen({ stock, onBack }) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backButtonText}>⬅️ Back to the list</Text>
      </TouchableOpacity>

      <View style={styles.detailHeaderCard}>
        <Text style={styles.detailEmoji}>{stock.emoji}</Text>
        <Text style={styles.detailTicker}>{stock.ticker}</Text>
        <Text style={styles.detailCompany}>{stock.name}</Text>
        <View style={styles.detailPriceRow}>
          <Text style={styles.detailPrice}>{stock.price}</Text>
          <PercentBadge change={stock.change} positive={stock.positive} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>📊</Text>
          <Text style={styles.statLabel}>Today's Range</Text>
          <Text style={styles.statValue}>{stock.stats.range}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>🔁</Text>
          <Text style={styles.statLabel}>Volume</Text>
          <Text style={styles.statValue}>{stock.stats.volume}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>🏦</Text>
          <Text style={styles.statLabel}>{stock.isIndex ? 'Made Of' : 'Market Cap'}</Text>
          <Text style={styles.statValue}>{stock.stats.cap}</Text>
        </View>
      </View>

      <View style={styles.deepDiveCard}>
        <Text style={styles.deepDiveHeading}>☕ The Tea</Text>
        <Text style={styles.deepDiveText}>{stock.deepDive.whatsGoingOn}</Text>
      </View>
      <View style={styles.deepDiveCard}>
        <Text style={styles.deepDiveHeading}>🧠 Why It Matters</Text>
        <Text style={styles.deepDiveText}>{stock.deepDive.whyItMatters}</Text>
      </View>
      <View style={styles.deepDiveCard}>
        <Text style={styles.deepDiveHeading}>🤔 Should You Care?</Text>
        <Text style={styles.deepDiveText}>{stock.deepDive.shouldYouCare}</Text>
      </View>

      <View style={styles.dataOnlyNote}>
        <Text style={styles.dataOnlyNoteText}>
          🎮 Want to practice trading this one? Head to the Paper Trading tab.
        </Text>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ---------------------------------------------
// TRADE PANEL (only used inside Paper Trading tab)
// ---------------------------------------------
function TradePanel({ stock, cash, ownedShares, onBuy, onSell }) {
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState('');
  const price = parsePrice(stock.price);
  const cost = price * qty;

  const handleBuy = () => {
    if (cost > cash) {
      setMessage("🚫 Not enough Loot Cash for that.");
      return;
    }
    onBuy(stock.ticker, qty, price);
    setMessage(`✅ Bought ${qty} share${qty === 1 ? '' : 's'} of ${stock.ticker}! +${XP_PER_TRADE} XP`);
  };

  const handleSell = () => {
    if (qty > ownedShares) {
      setMessage("🚫 You don't own that many shares.");
      return;
    }
    onSell(stock.ticker, qty, price);
    setMessage(`✅ Sold ${qty} share${qty === 1 ? '' : 's'} of ${stock.ticker}! +${XP_PER_TRADE} XP`);
  };

  return (
    <View style={styles.tradeCard}>
      <Text style={styles.tradeHeading}>🎮 Paper Trade</Text>
      <Text style={styles.tradeSubtext}>Practice with virtual Loot Cash — not real money.</Text>

      <View style={styles.tradeStatsRow}>
        <Text style={styles.tradeStat}>💰 Cash: {formatMoney(cash)}</Text>
        <Text style={styles.tradeStat}>🎒 Owned: {ownedShares}</Text>
      </View>

      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyButton} onPress={() => setQty((q) => Math.max(1, q - 1))}>
          <Text style={styles.qtyButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{qty}</Text>
        <TouchableOpacity style={styles.qtyButton} onPress={() => setQty((q) => q + 1)}>
          <Text style={styles.qtyButtonText}>+</Text>
        </TouchableOpacity>
        <Text style={styles.qtyCostText}>= {formatMoney(cost)}</Text>
      </View>

      <View style={styles.tradeButtonsRow}>
        <TouchableOpacity style={[styles.tradeButton, { backgroundColor: COLORS.green }]} activeOpacity={0.85} onPress={handleBuy}>
          <Text style={styles.tradeButtonText}>🛒 Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tradeButton, { backgroundColor: ownedShares > 0 ? COLORS.red : COLORS.textMuted }]}
          activeOpacity={0.85}
          onPress={handleSell}
          disabled={ownedShares === 0}
        >
          <Text style={styles.tradeButtonText}>💵 Sell</Text>
        </TouchableOpacity>
      </View>

      {message ? <Text style={styles.tradeMessage}>{message}</Text> : null}
    </View>
  );
}

// ---------------------------------------------
// PAPER TRADE DETAIL SCREEN
// (reached only from inside the Paper Trading tab)
// ---------------------------------------------
function PaperTradeDetailScreen({ stock, onBack, cash, holdings, onBuy, onSell }) {
  const ownedShares = holdings[stock.ticker] || 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backButtonText}>⬅️ Back to Paper Trading</Text>
      </TouchableOpacity>

      <View style={styles.detailHeaderCard}>
        <Text style={styles.detailEmoji}>{stock.emoji}</Text>
        <Text style={styles.detailTicker}>{stock.ticker}</Text>
        <Text style={styles.detailCompany}>{stock.name}</Text>
        <View style={styles.detailPriceRow}>
          <Text style={styles.detailPrice}>{stock.price}</Text>
          <PercentBadge change={stock.change} positive={stock.positive} />
        </View>
      </View>

      <TradePanel stock={stock} cash={cash} ownedShares={ownedShares} onBuy={onBuy} onSell={onSell} />

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ---------------------------------------------
// MAIN SCREENS
// ---------------------------------------------
function MarketScreen({ onSelectStock }) {
  const [activeVibe, setActiveVibe] = useState('trending');
  const activeVibeObj = VIBES.find((v) => v.key === activeVibe);
  const activeStocks = useMemo(
    () => Object.values(ASSETS).filter((a) => a.category === activeVibe),
    [activeVibe]
  );
  const tickers = useMemo(() => activeStocks.map((s) => s.ticker), [activeStocks]);
  const { liveMap, loading } = useLiveQuotes(tickers);

  return (
    <>
      <View style={styles.vibeSelectorRow}>
        {VIBES.map((v) => {
          const isActive = v.key === activeVibe;
          return (
            <TouchableOpacity
              key={v.key}
              onPress={() => setActiveVibe(v.key)}
              style={[styles.vibeTab, { borderColor: v.color }, isActive && { backgroundColor: v.color }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.vibeTabText, isActive && styles.vibeTabTextActive]} numberOfLines={1}>
                {v.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {LIVE_DATA_ENABLED && (
        <Text style={styles.liveStatusText}>
          {loading ? '🔄 Pulling live prices...' : '🟢 Live prices'}
        </Text>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeStocks.map((stock) => (
          <StockCard
            key={stock.ticker}
            stock={withLiveData(stock, liveMap)}
            accentColor={activeVibeObj.color}
            onPress={(s) => onSelectStock(withLiveData(s, liveMap))}
          />
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </>
  );
}

function WatchlistScreen({ onSelectStock, watchlist, setWatchlist }) {
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return Object.values(ASSETS).filter(
      (a) =>
        (a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) &&
        !watchlist.includes(a.ticker)
    ).slice(0, 6);
  }, [query, watchlist]);

  const watchedAssets = watchlist.map((t) => ASSETS[t]).filter(Boolean);
  const { liveMap, loading } = useLiveQuotes(watchlist);

  const addToWatchlist = (ticker) => {
    setWatchlist((prev) => (prev.includes(ticker) ? prev : [...prev, ticker]));
    setQuery('');
  };

  const removeFromWatchlist = (ticker) => {
    setWatchlist((prev) => prev.filter((t) => t !== ticker));
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.watchlistIntro}>
        <Text style={styles.watchlistIntroTitle}>🔎 Pull up anything</Text>
        <Text style={styles.watchlistIntroText}>
          Search any stock or index and track it here. No curation, no "hot picks" — just the raw info, your choice.
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search a ticker or company name..."
        placeholderTextColor={COLORS.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="characters"
      />

      {searchResults.length > 0 && (
        <View style={styles.searchResultsBox}>
          {searchResults.map((a) => (
            <TouchableOpacity
              key={a.ticker}
              style={styles.searchResultRow}
              onPress={() => addToWatchlist(a.ticker)}
              activeOpacity={0.7}
            >
              <Text style={styles.searchResultEmoji}>{a.emoji}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.searchResultTicker}>{a.ticker}</Text>
                <Text style={styles.searchResultName}>{a.name}</Text>
              </View>
              <Text style={styles.addText}>+ Add</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>
          {watchedAssets.length > 0 ? '📌 Your Watchlist' : '📌 Nothing added yet'}
        </Text>
        {LIVE_DATA_ENABLED && watchedAssets.length > 0 && (
          <Text style={styles.liveStatusTextInline}>{loading ? '🔄 updating...' : '🟢 live'}</Text>
        )}
      </View>

      {watchedAssets.length === 0 ? (
        <Text style={styles.emptyWatchlistText}>
          Search above and tap "+ Add" to start tracking a stock or index.
        </Text>
      ) : (
        watchedAssets.map((stock) => (
          <StockCard
            key={stock.ticker}
            stock={withLiveData(stock, liveMap)}
            onPress={(s) => onSelectStock(withLiveData(s, liveMap))}
            onRemove={removeFromWatchlist}
          />
        ))
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function PaperTradingScreen({ onSelectTradeStock, cash, holdings, xp, onReset }) {
  const [query, setQuery] = useState('');
  const { level, progress } = getXpProgress(xp);
  const { title, emoji } = getTitleForLevel(level);

  const holdingEntries = Object.entries(holdings).filter(([, qty]) => qty > 0);
  const holdingTickers = useMemo(() => holdingEntries.map(([t]) => t), [holdings]);
  const { liveMap: holdingsLiveMap } = useLiveQuotes(holdingTickers);

  const holdingsValue = holdingEntries.reduce((sum, [ticker, qty]) => {
    const asset = ASSETS[ticker];
    if (!asset) return sum;
    const live = withLiveData(asset, holdingsLiveMap);
    return sum + parsePrice(live.price) * qty;
  }, 0);
  const netWorth = cash + holdingsValue;

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return Object.values(ASSETS).filter(
      (a) => a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query]);
  const searchTickers = useMemo(() => searchResults.map((a) => a.ticker), [searchResults]);
  const { liveMap: searchLiveMap } = useLiveQuotes(searchTickers);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.levelCard}>
        <Text style={styles.levelCardEmoji}>{emoji}</Text>
        <Text style={styles.levelCardTitle}>Lvl {level} · {title}</Text>
        <XpBar xp={xp} />
      </View>

      <View style={styles.netWorthRow}>
        <View style={styles.netWorthBox}>
          <Text style={styles.netWorthEmoji}>💰</Text>
          <Text style={styles.netWorthLabel}>Loot Cash</Text>
          <Text style={styles.netWorthValue}>{formatMoney(cash)}</Text>
        </View>
        <View style={styles.netWorthBox}>
          <Text style={styles.netWorthEmoji}>📦</Text>
          <Text style={styles.netWorthLabel}>Holdings</Text>
          <Text style={styles.netWorthValue}>{formatMoney(holdingsValue)}</Text>
        </View>
        <View style={styles.netWorthBox}>
          <Text style={styles.netWorthEmoji}>🏆</Text>
          <Text style={styles.netWorthLabel}>Net Worth</Text>
          <Text style={styles.netWorthValue}>{formatMoney(netWorth)}</Text>
        </View>
      </View>

      <Text style={styles.sectionHeading}>🎯 Practice a trade</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search any stock or index to trade..."
        placeholderTextColor={COLORS.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="characters"
      />
      {searchResults.length > 0 && (
        <View style={styles.searchResultsBox}>
          {searchResults.map((a) => (
            <TouchableOpacity
              key={a.ticker}
              style={styles.searchResultRow}
              onPress={() => {
                onSelectTradeStock(withLiveData(a, searchLiveMap));
                setQuery('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.searchResultEmoji}>{a.emoji}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.searchResultTicker}>{a.ticker}</Text>
                <Text style={styles.searchResultName}>{a.name}</Text>
              </View>
              <Text style={styles.addText}>Trade →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.sectionHeading}>
        {holdingEntries.length > 0 ? "🎒 What's In Your Bag" : "🎒 Your Bag Is Empty"}
      </Text>

      {holdingEntries.length === 0 ? (
        <Text style={styles.emptyWatchlistText}>
          Search above for a stock or index to start paper trading.
        </Text>
      ) : (
        holdingEntries.map(([ticker, qty]) => {
          const asset = ASSETS[ticker];
          if (!asset) return null;
          return (
            <StockCard
              key={ticker}
              stock={withLiveData(asset, holdingsLiveMap)}
              onPress={(s) => onSelectTradeStock(s)}
              ownedShares={qty}
            />
          );
        })
      )}

      <TouchableOpacity style={styles.resetLink} onPress={onReset} activeOpacity={0.7}>
        <Text style={styles.resetLinkText}>↺ Reset paper trading progress</Text>
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function PerksScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.perksIntro}>
        <Text style={styles.perksIntroTitle}>👀 Only if you're interested</Text>
        <Text style={styles.perksIntroText}>
          These are totally optional! If you sign up through one of these links, we might earn a small commission 💰 — doesn't cost you anything extra.
        </Text>
      </View>

      <Text style={styles.sectionHeading}>📈 Brokerages</Text>
      {BROKERAGES.map((b) => (
        <PerkCard key={b.name} item={b} kind="brokerage" />
      ))}

      <Text style={styles.sectionHeading}>💳 Credit Cards</Text>
      {CREDIT_CARDS.map((c) => (
        <PerkCard key={c.name} item={c} kind="card" />
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ---------------------------------------------
// APP
// ---------------------------------------------
export default function App() {
  const [appStage, setAppStage] = useState('loading'); // loading | home | signup | main
  const [mainTab, setMainTab] = useState('market');
  const [selectedStock, setSelectedStock] = useState(null); // data-view detail (Market/Watchlist)
  const [tradingStock, setTradingStock] = useState(null); // paper-trade detail (Paper Trading tab only)
  const [watchlist, setWatchlist] = useState(['AAPL', 'SPX']);
  const [userName, setUserName] = useState('');

  const [cash, setCash] = useState(STARTING_CASH);
  const [holdings, setHoldings] = useState({});
  const [xp, setXp] = useState(0);
  const [levelUpMsg, setLevelUpMsg] = useState('');
  const levelUpTimer = useRef(null);

  const addXp = (amount) => {
    setXp((prevXp) => {
      const newXp = prevXp + amount;
      const oldLevel = getLevelFromXp(prevXp);
      const newLevel = getLevelFromXp(newXp);
      if (newLevel > oldLevel) {
        const { title, emoji } = getTitleForLevel(newLevel);
        setLevelUpMsg(`🎉 Level Up! ${emoji} Lvl ${newLevel} · ${title}`);
        if (levelUpTimer.current) clearTimeout(levelUpTimer.current);
        levelUpTimer.current = setTimeout(() => setLevelUpMsg(''), 3000);
      }
      return newXp;
    });
  };

  const handleBuy = (ticker, qty, price) => {
    setCash((c) => c - price * qty);
    setHoldings((h) => ({ ...h, [ticker]: (h[ticker] || 0) + qty }));
    addXp(XP_PER_TRADE);
  };

  const handleSell = (ticker, qty, price) => {
    setCash((c) => c + price * qty);
    setHoldings((h) => ({ ...h, [ticker]: Math.max(0, (h[ticker] || 0) - qty) }));
    addXp(XP_PER_TRADE);
  };

  const handleResetPortfolio = () => {
    setCash(STARTING_CASH);
    setHoldings({});
    setXp(0);
  };

  if (appStage === 'loading') {
    return <LoadingScreen onDone={() => setAppStage('home')} />;
  }

  if (appStage === 'home') {
    return (
      <HomeScreen
        onGuest={() => {
          setUserName('');
          setAppStage('main');
        }}
        onCreateAccount={() => setAppStage('signup')}
      />
    );
  }

  if (appStage === 'signup') {
    return (
      <SignupScreen
        onBack={() => setAppStage('home')}
        onSignup={(name) => {
          setUserName(name);
          setAppStage('main');
        }}
      />
    );
  }

  const TAB_META = {
    market: {
      title: '✨ Market Vibes',
      subtitle: userName ? `Hey ${userName} 👋 stocks, simplified.` : 'Stocks, simplified. No cap. 🧢',
    },
    watchlist: { title: '📌 Watchlist', subtitle: 'Track whatever you want, no filter' },
    paperTrade: { title: '🎮 Paper Trading', subtitle: 'Practice trades, level up, no real $$$' },
    perks: { title: '💸 Perks & Deals', subtitle: 'Optional extras, only if you want them' },
  };

  const detailStock = selectedStock || tradingStock;
  const headerTitle = detailStock ? `${detailStock.emoji} ${detailStock.ticker}` : TAB_META[mainTab].title;
  const headerSubtitle = selectedStock
    ? 'The full lowdown, no jargon'
    : tradingStock
    ? 'Practice mode'
    : TAB_META[mainTab].subtitle;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
        </View>
        <TouchableOpacity onPress={() => setMainTab('paperTrade')} activeOpacity={0.8}>
          <LevelChip xp={xp} />
        </TouchableOpacity>
      </View>

      {levelUpMsg ? (
        <View style={styles.levelUpToast}>
          <Text style={styles.levelUpToastText}>{levelUpMsg}</Text>
        </View>
      ) : null}

      {selectedStock ? (
        <StockDetailScreen stock={selectedStock} onBack={() => setSelectedStock(null)} />
      ) : tradingStock ? (
        <PaperTradeDetailScreen
          stock={tradingStock}
          onBack={() => setTradingStock(null)}
          cash={cash}
          holdings={holdings}
          onBuy={handleBuy}
          onSell={handleSell}
        />
      ) : mainTab === 'market' ? (
        <MarketScreen onSelectStock={setSelectedStock} />
      ) : mainTab === 'watchlist' ? (
        <WatchlistScreen onSelectStock={setSelectedStock} watchlist={watchlist} setWatchlist={setWatchlist} />
      ) : mainTab === 'paperTrade' ? (
        <PaperTradingScreen
          onSelectTradeStock={setTradingStock}
          cash={cash}
          holdings={holdings}
          xp={xp}
          onReset={handleResetPortfolio}
        />
      ) : (
        <PerksScreen />
      )}

      <View style={styles.disclaimerBanner}>
        <Text style={styles.disclaimerText}>
          ⚠️ NOT FINANCIAL ADVICE. Data-driven info on price & volume trends only. Paper Trading uses virtual Loot Cash — no real money involved. 🔍
        </Text>
      </View>

      {!selectedStock && !tradingStock && (
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.bottomNavItem} onPress={() => setMainTab('market')} activeOpacity={0.8}>
            <Text style={[styles.bottomNavText, mainTab === 'market' && styles.bottomNavTextActive]}>📊 Market</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomNavItem} onPress={() => setMainTab('watchlist')} activeOpacity={0.8}>
            <Text style={[styles.bottomNavText, mainTab === 'watchlist' && styles.bottomNavTextActive]}>📌 Watch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomNavItem} onPress={() => setMainTab('paperTrade')} activeOpacity={0.8}>
            <Text style={[styles.bottomNavText, mainTab === 'paperTrade' && styles.bottomNavTextActive]}>🎮 Trade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomNavItem} onPress={() => setMainTab('perks')} activeOpacity={0.8}>
            <Text style={[styles.bottomNavText, mainTab === 'perks' && styles.bottomNavTextActive]}>💸 Perks</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------
// STYLES
// ---------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  centerAll: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },

  // Loading screen
  loadingLogo: { fontSize: 56 },
  loadingAppName: { color: COLORS.ink, fontSize: 22, fontWeight: '900', marginTop: 6, letterSpacing: 0.3 },
  dogBox: { alignItems: 'center', marginTop: 36, marginBottom: 20 },
  dogEmoji: { fontSize: 64 },
  dogHands: { fontSize: 20, marginTop: -6 },
  loadingQuote: {
    color: COLORS.textSecondary, fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20, paddingHorizontal: 12,
  },

  // Home screen
  homeLogo: { fontSize: 64 },
  homeAppName: { color: COLORS.ink, fontSize: 34, fontWeight: '900', marginTop: 8, letterSpacing: 0.3 },
  homeTagline: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 4, marginBottom: 22 },
  homeCardsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  homeVibeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 2 },
  homeVibeChipText: { color: COLORS.ink, fontSize: 11.5, fontWeight: '800' },
  homePerkBox: {
    backgroundColor: COLORS.sunshineSoft, borderWidth: 2, borderColor: COLORS.sunshine, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 22,
  },
  homePerkText: { color: COLORS.ink, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  primaryButton: {
    backgroundColor: COLORS.hotPink, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center', width: '100%',
    shadowColor: COLORS.hotPink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { marginTop: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', width: '100%' },
  secondaryButtonText: { color: COLORS.violet, fontSize: 14, fontWeight: '800' },
  homeFooterText: { color: COLORS.textMuted, fontSize: 11.5, fontWeight: '600', marginTop: 18 },

  // Signup screen
  signupContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  signupLogo: { fontSize: 40, marginTop: 8 },
  signupTitle: { color: COLORS.ink, fontSize: 24, fontWeight: '900', marginTop: 8 },
  signupSubtitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 24 },
  inputLabel: { color: COLORS.ink, fontSize: 12.5, fontWeight: '800', marginBottom: 6, marginTop: 14 },
  textInputField: {
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 2, borderColor: COLORS.cardBorder,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600', color: COLORS.ink,
  },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-start' },
  headerTitle: { color: COLORS.ink, fontSize: 26, fontWeight: '900', letterSpacing: 0.2 },
  headerSubtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, fontWeight: '600' },

  // Level chip / XP
  levelChip: {
    backgroundColor: COLORS.ink, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginTop: 2,
  },
  levelChipText: { color: COLORS.sunshine, fontSize: 12, fontWeight: '900' },
  levelUpToast: {
    marginHorizontal: 16, marginBottom: 6, backgroundColor: COLORS.sunshine, borderRadius: 14,
    paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center',
  },
  levelUpToastText: { color: COLORS.ink, fontSize: 13, fontWeight: '900' },

  // Vibe selector
  vibeSelectorRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, marginBottom: 6 },
  vibeTab: {
    flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: 16,
    backgroundColor: COLORS.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  vibeTabText: { color: COLORS.ink, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  vibeTabTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Stock card
  card: {
    backgroundColor: COLORS.card, borderRadius: 22, borderWidth: 2.5, padding: 18, marginTop: 14,
    shadowColor: COLORS.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  cardEmoji: { fontSize: 34 },
  ticker: { color: COLORS.ink, fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  companyName: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  percentBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  percentBadgeText: { fontSize: 13, fontWeight: '900' },
  priceTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  price: { color: COLORS.ink, fontSize: 18, fontWeight: '800' },
  emojiTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  emojiTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  ownedText: { color: COLORS.green, fontSize: 12, fontWeight: '800', marginTop: 10 },
  blurbText: { color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 20, marginTop: 10, fontWeight: '500' },
  tapHintRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tapHintText: { color: COLORS.violet, fontSize: 11.5, fontWeight: '800' },
  removeText: { color: COLORS.red, fontSize: 11.5, fontWeight: '800' },

  // Watchlist
  watchlistIntro: {
    backgroundColor: COLORS.limeSoft, borderRadius: 18, borderWidth: 2, borderColor: COLORS.lime,
    padding: 16, marginTop: 8,
  },
  watchlistIntroTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '900', marginBottom: 6 },
  watchlistIntroText: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  searchInput: {
    marginTop: 8, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 2, borderColor: COLORS.violet,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontWeight: '700', color: COLORS.ink,
  },
  searchResultsBox: {
    marginTop: 8, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 2, borderColor: COLORS.cardBorder, overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#EEE8FA',
  },
  searchResultEmoji: { fontSize: 22 },
  searchResultTicker: { color: COLORS.ink, fontSize: 14, fontWeight: '900' },
  searchResultName: { color: COLORS.textMuted, fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  addText: { color: COLORS.hotPink, fontSize: 13, fontWeight: '900' },
  emptyWatchlistText: { color: COLORS.textMuted, fontSize: 12.5, fontWeight: '600', marginTop: 4, lineHeight: 18 },

  // Paper Trading / level
  levelCard: {
    backgroundColor: COLORS.violetSoft, borderRadius: 22, borderWidth: 2.5, borderColor: COLORS.violet,
    padding: 20, marginTop: 8, alignItems: 'center',
  },
  levelCardEmoji: { fontSize: 40 },
  levelCardTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '900', marginTop: 6, marginBottom: 12 },
  xpBarTrack: { width: 220, height: 14, borderRadius: 8, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 2, borderColor: COLORS.violet },
  xpBarFill: { height: '100%', backgroundColor: COLORS.hotPink },
  xpBarLabel: { color: COLORS.textSecondary, fontSize: 10.5, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  netWorthRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 4 },
  netWorthBox: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 2, borderColor: COLORS.sunshine,
    padding: 12, alignItems: 'center',
  },
  netWorthEmoji: { fontSize: 20 },
  netWorthLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', marginTop: 4 },
  netWorthValue: { color: COLORS.ink, fontSize: 12.5, fontWeight: '900', marginTop: 2, textAlign: 'center' },
  resetLink: { marginTop: 22, alignItems: 'center' },
  resetLinkText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },

  // Perks screen
  perksIntro: {
    backgroundColor: COLORS.sunshineSoft, borderRadius: 18, borderWidth: 2, borderColor: COLORS.sunshine,
    padding: 16, marginTop: 8,
  },
  perksIntroTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '900', marginBottom: 6 },
  perksIntroText: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  sectionHeading: { color: COLORS.ink, fontSize: 15, fontWeight: '900', marginTop: 22, marginBottom: 6 },
  sectionHeadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 6,
  },
  liveStatusText: { color: COLORS.green, fontSize: 11, fontWeight: '800', paddingHorizontal: 16, marginTop: 8 },
  liveStatusTextInline: { color: COLORS.green, fontSize: 11, fontWeight: '800' },
  perkCard: {
    backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 2, borderColor: COLORS.electricBlue,
    padding: 16, marginTop: 10,
  },
  perkTopRow: { flexDirection: 'row', alignItems: 'center' },
  perkEmoji: { fontSize: 30 },
  perkName: { color: COLORS.ink, fontSize: 16, fontWeight: '900' },
  perkDetail: { color: COLORS.textSecondary, fontSize: 12.5, marginTop: 2, fontWeight: '600' },
  perkButton: {
    backgroundColor: COLORS.hotPink, borderRadius: 14, paddingVertical: 11, marginTop: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  perkButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' },
  sponsoredTag: { color: COLORS.textMuted, fontSize: 10, marginTop: 8, textAlign: 'center', fontWeight: '700' },

  // Detail screen (data-only)
  detailContent: { paddingHorizontal: 16, paddingTop: 4 },
  backButton: { marginBottom: 12 },
  backButtonText: { color: COLORS.violet, fontSize: 14, fontWeight: '800' },
  detailHeaderCard: {
    backgroundColor: COLORS.violetSoft, borderRadius: 24, borderWidth: 2.5, borderColor: COLORS.violet,
    padding: 22, alignItems: 'center',
  },
  detailEmoji: { fontSize: 48 },
  detailTicker: { color: COLORS.ink, fontSize: 32, fontWeight: '900', marginTop: 6 },
  detailCompany: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  detailPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  detailPrice: { color: COLORS.ink, fontSize: 22, fontWeight: '900', marginRight: 10 },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 8 },
  statBox: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 2, borderColor: COLORS.electricBlue,
    padding: 10, alignItems: 'center',
  },
  statEmoji: { fontSize: 18, marginBottom: 4 },
  statLabel: { color: COLORS.textMuted, fontSize: 9.5, fontWeight: '800', textAlign: 'center' },
  statValue: { color: COLORS.ink, fontSize: 11.5, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  dataOnlyNote: {
    backgroundColor: COLORS.limeSoft, borderRadius: 14, borderWidth: 2, borderColor: COLORS.lime,
    padding: 12, marginTop: 16,
  },
  dataOnlyNoteText: { color: COLORS.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Trade panel
  tradeCard: {
    backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 2.5, borderColor: COLORS.lime,
    padding: 18, marginTop: 16,
  },
  tradeHeading: { color: COLORS.ink, fontSize: 15, fontWeight: '900' },
  tradeSubtext: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2, marginBottom: 12 },
  tradeStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  tradeStat: { color: COLORS.textSecondary, fontSize: 12.5, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  qtyButton: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.violetSoft, borderWidth: 2, borderColor: COLORS.violet,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyButtonText: { color: COLORS.violet, fontSize: 18, fontWeight: '900' },
  qtyValue: { color: COLORS.ink, fontSize: 16, fontWeight: '900', marginHorizontal: 14, minWidth: 24, textAlign: 'center' },
  qtyCostText: { color: COLORS.textSecondary, fontSize: 12.5, fontWeight: '800', marginLeft: 'auto' },
  tradeButtonsRow: { flexDirection: 'row', gap: 10 },
  tradeButton: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tradeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  tradeMessage: { color: COLORS.ink, fontSize: 12, fontWeight: '700', marginTop: 10, textAlign: 'center' },

  deepDiveCard: {
    backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 2, borderColor: COLORS.hotPink,
    padding: 16, marginTop: 14,
  },
  deepDiveHeading: { color: COLORS.hotPink, fontSize: 13.5, fontWeight: '900', marginBottom: 8, letterSpacing: 0.3 },
  deepDiveText: { color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 21, fontWeight: '600' },

  // Disclaimer + bottom nav
  disclaimerBanner: { backgroundColor: COLORS.ink, paddingHorizontal: 16, paddingVertical: 8 },
  disclaimerText: { color: '#FFFFFF', fontSize: 10, lineHeight: 13, textAlign: 'center', fontWeight: '700' },
  bottomNav: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderTopWidth: 2, borderTopColor: COLORS.cardBorder,
    paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomNavText: { color: COLORS.textMuted, fontSize: 11.5, fontWeight: '800' },
  bottomNavTextActive: { color: COLORS.hotPink },
});
