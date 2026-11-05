(() => {
  'use strict';
  const C = window.PrismCore;
  const $ = id => document.getElementById(id);
  const state = {query:'',tab:'all',sort:'relevance',lang:'en',items:[],errors:[],loaded:false,show:12,busy:false};
  const collections = ['news','research','reference'];
  const timeoutFetch = async (url, ms=13500) => {const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),ms);try{const res=await fetch(url,{signal:ctl.signal,headers:{Accept:'application/json'},credentials:'omit'});if(!res.ok)throw Error(`HTTP ${res.status}`);const body=await res.json();return body;}finally{clearTimeout(t);}};
  async function provider(type,q) {
    if(type==='news') {
      const params=new URLSearchParams({query:q,mode:'artlist',maxrecords:'60',format:'json',sort:'datedesc'});
      return C.parseNews(await timeoutFetch('https://api.gdeltproject.org/api/v2/doc/doc?'+params,18000));
    }
    if(type==='research') {
      const params=new URLSearchParams({search:q,'per-page':'35',select:'id,display_name,doi,publication_year,publication_date,primary_location,authorships,cited_by_count'});
      return C.parseResearch(await timeoutFetch('https://api.openalex.org/works?'+params));
    }
    const lang=state.lang;
    const params=new URLSearchParams({action:'query',list:'search',srsearch:q,srlimit:'35',srprop:'snippet|timestamp',format:'json',origin:'*'});
    const data=await timeoutFetch(`https://${lang}.wikipedia.org/w/api.php?${params}`);
    if(data.error)throw Error(data.error.info||'Wikipedia API error');
    return C.parseReference(data,lang);
  }
  function updateQueryUrl() {const url=new URL(window.location.href);if(state.query)url.searchParams.set('q',state.query);else url.searchParams.delete('q');window.history.replaceState(null,'',url);}
  async function search(q) {
    const query=C.cleanQuery(q);if(!query)return;
    state.query=query;state.show=12;state.items=[];state.errors=[];state.loaded=false;state.busy=true;
    $('query').value=query;updateQueryUrl();
    $('resultsTitle').textContent=`Results for “${query}”`;
    $('resultsSubtitle').textContent='Searching news, research and reference';
    $('statusPill').textContent='Searching…';$('statusPill').classList.add('working');
    $('results').innerHTML='<div class="loading"><span class="loader"></span><h3>Searching…</h3></div>';
    $('providerStatus').hidden=true;renderActions();
    const settled=await Promise.allSettled(collections.map(c=>provider(c,query)));
    settled.forEach((res,i)=>{if(res.status==='fulfilled')state.items.push(...res.value);else state.errors.push({name:collections[i],message:String(res.reason?.message||res.reason||'Service unavailable')});});
    state.items=C.uniqueResults(state.items);state.loaded=true;state.busy=false;
    $('statusPill').textContent=`${state.items.length} results`;$('statusPill').classList.remove('working');
    $('resultsSubtitle').textContent='GDELT · OpenAlex · Wikipedia';
    render();
    document.getElementById('resultsSection').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function currentItems(){let items=state.tab==='all'?state.items:state.items.filter(i=>i.type===state.tab);return C.sortResults(items,state.sort);}
  function render() {
    const items=currentItems();
    const notes=state.errors.map(e=>`${e.name}: ${e.message}`);
    const p=$('providerStatus');
    if(notes.length){p.hidden=false;p.textContent=`Unavailable: ${notes.join(' · ')}`;}else p.hidden=true;
    if(!state.loaded)return;
    if(!items.length){$('results').innerHTML='<div class="empty-state"><span class="empty-glyph">⌕</span><h3>No results found.</h3><p>Try different keywords or another collection.</p></div>';}else {
      $('results').innerHTML=items.slice(0,state.show).map((r,index)=>{
        const url=C.escaped(r.url),title=C.escaped(r.title),domain=C.escaped(r.domain),excerpt=C.escaped(r.excerpt);
        const type=r.type==='news'?'NEWS':r.type==='research'?'RESEARCH':'REFERENCE';
        const dt=asDate(r.date);
        return `<article class="result-card"><div class="result-meta"><span class="type type-${r.type}">${type}</span><span>${C.escaped(r.provider)}</span>${dt?`<span>· ${C.escaped(dt)}</span>`:''}</div><h3><a href="${url}" target="_blank" rel="noopener noreferrer">${title}<span class="result-arrow" aria-hidden="true">↗</span></a></h3><div class="result-domain">${domain}</div><p>${excerpt}</p></article>`;
      }).join('');
    }
    const counts={news:0,research:0,reference:0};
    state.items.forEach(x=>counts[x.type]++);
    const domains=[...new Set(state.items.map(x=>x.domain).filter(Boolean))];
    $('perspectiveSummary').innerHTML=[['News',counts.news],['Research',counts.research],['Reference',counts.reference]].map(([name,count])=>`<div class="source-row"><span>${name}</span><strong>${count}</strong></div>`).join('')+`<div class="source-domains">${domains.length} distinct domains in this search</div>`;
    renderActions();
  }
  function asDate(s){if(!s)return '';const d=/^\d{14}$/.test(s)?new Date(Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8))):new Date(s);return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});}
  function renderActions(){const visible=currentItems();$('moreBtn').hidden=!state.loaded||state.show>=visible.length;$('exportBtn').hidden=!state.loaded||!visible.length;}
  function download() {const payload={query:state.query,exported:new Date().toISOString(),collection:state.tab,results:currentItems()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='prism-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  function inspect(){const value=$('articleText').value.trim();const out=C.inspectText(value);if(!out){$('inspection').textContent='Paste some article text first.';return;}
    const item=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
    let html=`<div class="inspection-grid">${item('Words',out.words)}${item('Sentences',out.sentences)}${item('Quoted passages',out.quotes.length)}${item('External links',out.urls.length)}</div>`;
    
    if(out.candidates.length)html+='<h4>Statements worth checking</h4><ol>'+out.candidates.map(s=>`<li>${C.escaped(s)}</li>`).join('')+'</ol>';
    else html+='<p>No numerical or attributed claims found.</p>';
    if(out.urls.length)html+='<h4>Links in text</h4><ul>'+out.urls.map(s=>`<li><a target="_blank" rel="noopener noreferrer" href="${C.escaped(s)}">${C.escaped(C.domainOf(s))}</a></li>`).join('')+'</ul>';
    $('inspection').innerHTML=html;
  }
  function switchTab(tab){state.tab=tab;state.show=12;document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});render();}
  $('searchForm').addEventListener('submit',e=>{e.preventDefault();if(!state.busy)search($('query').value);});
  document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>search(b.dataset.example)));
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  $('lang').addEventListener('change',()=>{state.lang=$('lang').value;if(state.query)search(state.query);});
  $('sort').addEventListener('change',()=>{state.sort=$('sort').value;render();});
  $('moreBtn').addEventListener('click',()=>{state.show+=12;render();});$('exportBtn').addEventListener('click',download);$('inspectBtn').addEventListener('click',inspect);
  $('year').textContent=new Date().getFullYear();
  $('methodBtn').addEventListener('click',()=>$('aboutDialog').showModal());
  const dialog=$('aboutDialog');$('aboutBtn').addEventListener('click',()=>dialog.showModal());$('closeDialog').addEventListener('click',()=>dialog.close());$('dismissDialog').addEventListener('click',()=>dialog.close());
  const original=new URLSearchParams(location.search).get('q');if(original)search(original);
})();
