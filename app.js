const API_FIELDS = 'key,title,author_name,cover_i,first_publish_year,edition_count';
const API_LIMIT = 10;
const STORAGE_KEY = 'booksgalore_books_v1';

const el = (id)=>document.getElementById(id);

let lastFetch = 0;
let debounceTimer = null;
let scheduledSearch = null;

const state = {
  view: 'search', // or 'bookshelf'
  results: [],
  saved: loadSaved(),
  filters: {
    sort: 'relevance', era: 'any', hasCover:false, minEditions:0
  }
};

function loadSaved(){
  try{const j=localStorage.getItem(STORAGE_KEY);return j?JSON.parse(j):{};}catch(e){return{}}}
function saveSaved(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state.saved));}

async function doFetch(query){
  lastFetch = Date.now();
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=${API_FIELDS}&limit=${API_LIMIT}`;
  try{
    const res = await fetch(url);
    const json = await res.json();
    state.results = (json.docs||[]).map(normalize);
    applyFiltersAndRender();
  }catch(e){console.error(e);renderResults([])}
}

// Search with simple scheduling to respect ~1 request/second rate limit.
function search(query){
  if(!query) return renderResults([]);
  const now = Date.now();
  const remaining = 1000 - (now - lastFetch);
  if(remaining > 0){
    if(scheduledSearch) clearTimeout(scheduledSearch);
    scheduledSearch = setTimeout(()=>{ doFetch(query); scheduledSearch = null; }, remaining);
    return;
  }
  doFetch(query);
}

function normalize(d){
  return {
    id: d.key,
    title: d.title||'Untitled',
    authors: d.author_name||[],
    cover_i: d.cover_i||null,
    year: d.first_publish_year||null,
    edition_count: d.edition_count||0,
  };
}

function renderResults(list){
  const container = el('results');container.innerHTML='';
  if(!list.length){container.innerHTML='<p class="empty">No results</p>';return}
  list.forEach(book=>{
    const card = document.createElement('article');card.className='card';
    const img = document.createElement('img');
    if(book.cover_i){img.src=`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`;img.alt=book.title}else{
      img.src='';img.alt='No cover';img.style.background='#FFF3E0';img.style.height='220px';img.style.display='block';img.style.padding='24px';img.style.backgroundImage=`linear-gradient(180deg, #FFF8F2, #F9F3EA)`;img.style.backgroundSize='cover';img.style.textAlign='center';
    }
    card.appendChild(img);
    const body = document.createElement('div');body.className='card-body';
    const h = document.createElement('h3');h.className='title';h.textContent=book.title;
    const m = document.createElement('div');m.className='meta';m.textContent=(book.authors.join(', ') || 'Unknown') + (book.year?(' • '+book.year):'');
    body.appendChild(h);body.appendChild(m);
    card.appendChild(body);
    const actions = document.createElement('div');actions.className='card-actions';
    const btn = document.createElement('button');
    const saved = state.saved[book.id];
    if(saved){
      btn.textContent = saved.status === 'read' ? 'Read' : 'Want to Read';
      btn.className='btn secondary';
      const badge = document.createElement('span');badge.className=`badge ${saved.status==='read'?'read':'want'}`;badge.textContent = saved.status==='read'?'Read':'Want';actions.appendChild(badge);
    }else{btn.textContent='Save';btn.className='btn'}
    btn.addEventListener('click',(ev)=>{ev.stopPropagation();toggleSave(book);renderCurrentView();});
    actions.appendChild(btn);
    card.appendChild(actions);
    card.addEventListener('click',()=>openModal(book));
    container.appendChild(card);
  })
}

function applyFiltersAndRender(){
  let list = [...state.results];
  const f=state.filters;
  if(f.hasCover){list = list.filter(b=>b.cover_i)}
  if(f.minEditions>0){list = list.filter(b=>b.edition_count>=f.minEditions)}
  if(f.era!=='any'){
    list = list.filter(b=>{
      const y = b.year||0; if(f.era==='classic')return y>0 && y<1950; if(f.era==='modern')return y>=1950 && y<=2000; if(f.era==='contemporary')return y>2000; return true;
    })
  }
  if(f.sort==='year-desc') list.sort((a,b)=>(b.year||0)-(a.year||0));
  if(f.sort==='year-asc') list.sort((a,b)=>(a.year||0)-(b.year||0));
  renderResults(list);
}

function toggleSave(book){
  if(state.saved[book.id]){
    delete state.saved[book.id];
  }else{
    state.saved[book.id]={...book,status:'want',saved_at:Date.now()};
  }
  saveSaved();
}

function openModal(book){
  const modal = el('modal'); modal.setAttribute('aria-hidden','false');
  const body = el('modal-body'); body.innerHTML='';
  const img = document.createElement('img');img.style.maxWidth='200px';img.style.float='left';img.style.marginRight='12px';
  if(book.cover_i) img.src=`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`; else img.src='';
  body.appendChild(img);
  const h = document.createElement('h2');h.textContent=book.title; body.appendChild(h);
  const a = document.createElement('div');a.textContent = (book.authors.join(', ')||'Unknown');a.style.color='var(--color-text-muted)'; body.appendChild(a);
  const meta = document.createElement('p');meta.textContent = `Year: ${book.year||'Unknown'} • Editions: ${book.edition_count||0}`; body.appendChild(meta);
  const saved = state.saved[book.id];
  const statusBtn = document.createElement('button');
  statusBtn.textContent = saved? (saved.status==='read'?'Mark Want to Read':'Mark Read') : 'Save to bookshelf';
  statusBtn.className='btn';
  statusBtn.addEventListener('click',()=>{
    if(!state.saved[book.id]){state.saved[book.id]={...book,status:'want',saved_at:Date.now()};}
    else{state.saved[book.id].status = state.saved[book.id].status==='read'?'want':'read';}
    saveSaved(); renderCurrentView(); openModal(book); // refresh modal
  });
  body.appendChild(statusBtn);
}

function closeModal(){const modal=el('modal');modal.setAttribute('aria-hidden','true')}

function renderBookshelf(){
  const books = Object.values(state.saved);
  el('view-title').textContent='Your Bookshelf';
  el('results').innerHTML='';
  if(!books.length){el('empty').hidden=false;return}
  el('empty').hidden=true;
  books.forEach(b=>{
    const card = document.createElement('article');card.className='card';
    const img = document.createElement('img');if(b.cover_i) img.src=`https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`; else img.src='';card.appendChild(img);
    const body = document.createElement('div');body.className='card-body';
    const h = document.createElement('h3');h.className='title';h.textContent=b.title;body.appendChild(h);
    const m = document.createElement('div');m.className='meta';m.textContent=(b.authors.join(', ') || 'Unknown') + (b.year?(' • '+b.year):'');body.appendChild(m);
    card.appendChild(body);
    const actions = document.createElement('div');actions.className='card-actions';
    const badge = document.createElement('span');badge.className=`badge ${b.status==='read'?'read':'want'}`;badge.textContent = b.status==='read'?'Read':'Want';actions.appendChild(badge);
    const toggle = document.createElement('button');toggle.className='btn secondary';toggle.textContent='Toggle';toggle.addEventListener('click',()=>{state.saved[b.id].status = state.saved[b.id].status==='read'?'want':'read';saveSaved();renderBookshelf();});actions.appendChild(toggle);
    const remove = document.createElement('button');remove.className='btn';remove.textContent='Remove';remove.addEventListener('click',()=>{delete state.saved[b.id];saveSaved();renderBookshelf();});actions.appendChild(remove);
    card.appendChild(actions);
    el('results').appendChild(card);
  })
}

function renderCurrentView(){
  if(state.view==='bookshelf'){renderBookshelf()}else{el('view-title').textContent='Search Results';applyFiltersAndRender();}
}

// UI wiring
document.addEventListener('click',e=>{
  if(e.target.id==='filters-toggle'){
    document.querySelector('.filters').classList.toggle('show');
  }
});

el('search-spine').addEventListener('click',()=>{document.querySelector('.search-wrap').classList.add('expanded');el('search-input').focus();});
el('search-input').addEventListener('blur',()=>{if(!el('search-input').value)document.querySelector('.search-wrap').classList.remove('expanded');});

el('search-input').addEventListener('input',(e)=>{
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(()=>{search(e.target.value.trim())},700);
});

el('bookshelf-btn').addEventListener('click',()=>{state.view = state.view==='bookshelf'?'search':'bookshelf'; renderCurrentView();});
el('filters-close').addEventListener('click',()=>document.querySelector('.filters').classList.remove('show'));

Array.from(document.querySelectorAll('input[name="era"]')).forEach(r=>r.addEventListener('change',(e)=>{state.filters.era=e.target.value;applyFiltersAndRender()}));
el('sort-select').addEventListener('change',(e)=>{state.filters.sort=e.target.value;applyFiltersAndRender()});
el('has-cover').addEventListener('change',(e)=>{state.filters.hasCover=e.target.checked;applyFiltersAndRender()});
el('min-editions').addEventListener('change',(e)=>{state.filters.minEditions=Number(e.target.value);applyFiltersAndRender()});

el('modal-overlay').addEventListener('click',closeModal);el('modal-close').addEventListener('click',closeModal);

// initial
renderCurrentView();

// Allow typing anywhere to focus the search input so users can start typing book names immediately.
document.addEventListener('keydown',(e)=>{
  const inp = el('search-input');
  if(!inp) return;
  const active = document.activeElement;
  if(active === inp) return; // already focused
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if(k.length === 1 && /\S/.test(k)){
    document.querySelector('.search-wrap').classList.add('expanded');
    inp.focus();
    // append typed character
    inp.value = (inp.value || '') + k;
    inp.dispatchEvent(new Event('input', {bubbles:true}));
    e.preventDefault();
  }
});
