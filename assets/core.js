(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PrismCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const safeText = v => String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  function canonicalUrl(value) {
    try { const u = new URL(value); if (!['https:', 'http:'].includes(u.protocol)) return null; return u.href; } catch { return null; }
  }
  function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
  function cleanQuery(q) { return String(q || '').replace(/\s+/g, ' ').trim().slice(0, 180); }
  function parseNews(data) {
    return (Array.isArray(data?.articles) ? data.articles : []).map((a, i) => ({
      id: `news-${i}-${a.url || ''}`, title: safeText(a.title), url: canonicalUrl(a.url),
      domain: domainOf(a.url), date: a.seendate || '', provider: 'GDELT', type: 'news',
      excerpt: a.sourcecountry ? `Coverage from ${a.sourcecountry}${a.language ? ` · ${a.language}` : ''}` : 'International news coverage',
      political: 'Unrated', credibility: 'Unrated'
    })).filter(x => x.title && x.url);
  }
  function parseResearch(data) {
    return (Array.isArray(data?.results) ? data.results : []).map((a, i) => {
      const url = canonicalUrl(a.primary_location?.landing_page_url || a.doi || a.id);
      return {id:`research-${a.id || i}`,title:safeText(a.display_name),url,domain:domainOf(url),date:a.publication_date || '',provider:'OpenAlex',type:'research',excerpt:[a.authorships?.slice(0,2).map(x=>x.author?.display_name).filter(Boolean).join(', '),a.primary_location?.source?.display_name,a.publication_year].filter(Boolean).join(' · ') || 'Scholarly publication',political:'Not applicable',credibility:'Not assessed',citations:Number(a.cited_by_count)||0};
    }).filter(x => x.title && x.url);
  }
  function parseReference(data, lang='en') {
    return (Array.isArray(data?.query?.search) ? data.query.search : []).map((a,i)=>({
      id:`reference-${lang}-${a.pageid || i}`,title:safeText(a.title),url:`https://${lang}.wikipedia.org/?curid=${encodeURIComponent(a.pageid)}`,domain:`${lang}.wikipedia.org`,date:a.timestamp || '',provider:'Wikipedia',type:'reference',excerpt:safeText(a.snippet) || 'Encyclopedia entry',political:'Not applicable',credibility:'Not assessed'
    })).filter(x=>x.title);
  }
  function uniqueResults(items) { const seen = new Set(); return items.filter(x=>{const key=(x.url||'').replace(/\/$/,'').toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;}); }
  function sortResults(items, sort='relevance') { if(sort!=='newest')return [...items];return [...items].sort((a,b)=>{const ad=Date.parse(a.date)||0,bd=Date.parse(b.date)||0;return bd-ad;}); }
  function inspectText(raw) {
    const text=String(raw || '').trim();if(!text)return null;
    const words=text.match(/[\p{L}\p{N}’'-]+/gu)||[];
    const sentences=text.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean);
    const quotes=[...text.matchAll(/[“"]([^”"]{12,400})[”"]/g)].slice(0,12).map(x=>x[1].trim());
    const numbers=[...new Set(text.match(/\b\d+(?:[.,]\d+)?\s?%?\b/g)||[])].slice(0,15);
    const urls=[...new Set(text.match(/https?:\/\/[^\s<>"']+/g)||[])].slice(0,20).filter(u=>canonicalUrl(u));
    const candidates=sentences.filter(s=>s.length>=35&&s.length<=360&&(/\b(?:\d+(?:[.,]\d+)?%?|according to|found that|reported that|study|research|survey|data|million|billion)\b/i.test(s))).slice(0,8);
    return {words:words.length,sentences:sentences.length,quotes,numbers,urls,candidates};
  }
  function escaped(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  return {safeText,canonicalUrl,domainOf,cleanQuery,parseNews,parseResearch,parseReference,uniqueResults,sortResults,inspectText,escaped};
});
