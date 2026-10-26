// Where memes come from: meme communities on Reddit, grouped by region.
// Fetched through meme-api.com (falls back to Reddit directly).
// Adult (NSFW) and spoiler posts are always filtered out in memes.js.
window.REGIONS = [
  { id: 'global', flag: '🌍', name: 'Global', subs: ['memes', 'dankmemes', 'me_irl', 'meirl', 'shitposting', 'comedyheaven', 'terriblefacebookmemes'] },
  { id: 'nerd', flag: '💻', name: 'Nerd', subs: ['ProgrammerHumor', 'HistoryMemes', 'sciencememes', 'mathmemes'] },
  { id: 'ph', flag: '🇵🇭', name: 'Philippines', subs: ['PinoyMemes', 'phmemes', 'Philippines_Expats_Memes'] },
  { id: 'de', flag: '🇩🇪', name: 'Germany', subs: ['ich_iel', 'OkBrudiMongo'] },
  { id: 'fr', flag: '🇫🇷', name: 'France', subs: ['moi_dlvv', 'rance'] },
  { id: 'es', flag: '🇪🇸', name: 'Spanish', subs: ['yo_elvr', 'MAAU'] },
  { id: 'br', flag: '🇧🇷', name: 'Brazil', subs: ['eu_nvr', 'DiretoDoZapZap'] },
  { id: 'nl', flag: '🇳🇱', name: 'Netherlands', subs: ['ik_ihe'] },
  { id: 'in', flag: '🇮🇳', name: 'India', subs: ['IndianDankMemes', 'dankindianmemes'] },
  { id: 'uk', flag: '🇬🇧', name: 'UK', subs: ['britishmemes'] },
  { id: 'it', flag: '🇮🇹', name: 'Italy', subs: ['italy_memes', 'yo_mamma_italiana'] },
  { id: 'pl', flag: '🇵🇱', name: 'Poland', subs: ['Polska_wpz', 'okkolegauposledzony'] },
];
