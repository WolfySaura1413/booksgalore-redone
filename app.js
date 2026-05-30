// Minimal Booksgalore app.js
(function(){
  const API_BASE = 'https://openlibrary.org/search.json';
  const RESULTS_LIMIT = 10;
  const FIELDS = 'key,title,author_name,cover_i,first_publish_year,edition_count';

  const searchInput = document.getElementById('searchInput');
  const resultsEl = document.getElementById('results');
  const bookshelfBtn = document.getElementById('bookshelfBtn');
  const viewTitle = document.getElementById('viewTitle');
  const openFilters = document.getElementById('openFilters');
  const toggleFilters = document.getElementById('toggleFilters');
  const filtersPanel = document.getElementById('filters');

  const sortByEl = document.getElementById('sortBy');
  const eraEl = document.getElementById('era');
  const hasCoverEl = document.getElementById('hasCover');
  const minEditionsEl = document.getElementById('minEditions');

  const modal = document.getElementById('modal');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const modalContent = document.getElementById('modalContent');

  let currentResults = [];
  let saved = loadSaved();
  let inBookshelf = false;

  // Debounce and rate limit
  function debounce(fn, wait){
    let t;
    return function(...a){
      clearTimeout(t);
      t = setTimeout(()=>fn.apply(this,a), wait);
    }
  }

  async function search(query){
    if(!query || !query.trim()) return;
    viewTitle.textContent = `Search: "${query}"`;
    // show loading
    resultsEl.innerHTML = '<p>Loading…</p>';

    const q = encodeURIComponent(query);
    const url = `${API_BASE}?q=${q}&fields=${FIELDS}&limit=${RESULTS_LIMIT}`;

    try{
      const res = await fetch(url);
      if(!res.ok) throw new Error('Network error');
      const data = await res.json();
      currentResults = (data.docs || []).map(doc=>({
        key: doc.key,
        title: doc.title,
        authors: doc.author_name || [],
        cover_i: doc.cover_i,
        year: doc.first_publish_year,
        edition_count: doc.edition_count || 0
      }));
      renderResults(applyFilters(currentResults));
    }catch(e){
      resultsEl.innerHTML = `<p class="meta">Error: ${e.message}</p>`;
    }
  }

  // Apply client-side filters
  function applyFilters(list){
    let out = [...list];
    // has cover
    if(hasCoverEl.checked) out = out.filter(b => b.cover_i);
    // min editions
    const me = minEditionsEl.value;
    if(me !== 'any') out = out.filter(b => (b.edition_count || 0) >= parseInt(me,10));
    // era
    const era = eraEl.value;
    if(era === 'classic') out = out.filter(b => b.year && b.year < 1950);
    if(era === 'modern') out = out.filter(b => b.year && b.year >= 1950 && b.year <= 2000);
    if(era === 'contemporary') out = out.filter(b => b.year && b.year >= 2001);
    // sort
    const sort = sortByEl.value;
    if(sort === 'year-desc') out.sort((a,b)=>(b.year||0)-(a.year||0));
    if(sort === 'year-asc') out.sort((a,b)=>(a.year||0)-(b.year||0));
    return out;
  }

  function renderResults(list){
    if(inBookshelf){
      if(!list.length) resultsEl.innerHTML = '<p>Your bookshelf is empty. Save books to see them here.</p>';
    }
    if(!list || list.length === 0){
      resultsEl.innerHTML = '<p>No results.</p>';
      return;
    }
    resultsEl.innerHTML = '';
    list.forEach(b => {
      const card = document.createElement('article');
      card.className = 'card';

      const cover = document.createElement('div');
      cover.className = 'cover';
      if(b.cover_i){
        const img = document.createElement('img');
        img.src = `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`;
        img.alt = b.title || 'Cover';
        cover.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'placeholder-icon';
        ph.innerHTML = '<svg width="36" height="48" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="14" height="28" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6 8h8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>';
        cover.appendChild(ph);
      }

      const body = document.createElement('div');
      body.className = 'card-body';
      const title = document.createElement('h4'); title.className = 'title'; title.textContent = b.title || 'Untitled';
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${(b.authors||[]).join(', ') || 'Unknown author'} • ${b.year || '—'}`;
      body.appendChild(title); body.appendChild(meta);

      const actions = document.createElement('div'); actions.className = 'card-actions';
      const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-primary';
      const savedItem = saved[b.key];
      if(savedItem){
        saveBtn.textContent = savedItem.status === 'read' ? 'Read' : 'Want to Read';
      } else saveBtn.textContent = 'Save';

      saveBtn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        toggleSave(b);
        // re-render to update button
        renderResults(list);
      });

      actions.appendChild(saveBtn);

      card.appendChild(cover);
      card.appendChild(body);
      card.appendChild(actions);

      card.addEventListener('click', ()=>openModal(b));

      resultsEl.appendChild(card);
    });
  }

  function openModal(book){
    modal.classList.remove('hidden');
    modalContent.innerHTML = '';
    const cover = document.createElement('div'); cover.style.display='flex'; cover.style.gap='12px';
    const imgWrap = document.createElement('div'); imgWrap.style.width='160px';
    if(book.cover_i){
      const img = document.createElement('img'); img.src = `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`; img.style.width='160px'; img.alt = book.title;
      imgWrap.appendChild(img);
    } else {
      const ph = document.createElement('div'); ph.className='placeholder-icon'; ph.style.width='160px'; ph.style.height='220px'; ph.innerHTML = '<svg width="48" height="64" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="14" height="28" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>';
      imgWrap.appendChild(ph);
    }

    const info = document.createElement('div');
    const h = document.createElement('h2'); h.textContent = book.title; h.style.fontFamily='var(--font-heading)';
    const a = document.createElement('div'); a.className='meta'; a.textContent = `${(book.authors||[]).join(', ') || 'Unknown author'}`;
    const y = document.createElement('div'); y.className='meta'; y.textContent = `First published: ${book.year || '—'}`;
    const e = document.createElement('div'); e.className='meta'; e.textContent = `Edition count: ${book.edition_count || 0}`;

    const saveBtn = document.createElement('button'); saveBtn.className='btn btn-primary';
    const savedItem = saved[book.key];
    if(savedItem){
      saveBtn.textContent = savedItem.status === 'read' ? 'Mark Want to Read' : 'Mark Read';
    } else saveBtn.textContent = 'Save to Bookshelf';

    saveBtn.addEventListener('click', ()=>{
      if(saved[book.key]){
        // toggle status
        saved[book.key].status = saved[book.key].status === 'read' ? 'want' : 'read';
      } else {
        saved[book.key] = { ...book, status: 'want' };
      }
      persistSaved();
      renderResults(applyFilters(inBookshelf ? Object.values(saved) : currentResults));
      openModal(book);
    });

    const removeBtn = document.createElement('button'); removeBtn.className='btn btn-secondary'; removeBtn.textContent='Remove';
    removeBtn.addEventListener('click', ()=>{
      delete saved[book.key]; persistSaved(); renderResults(applyFilters(inBookshelf ? Object.values(saved) : currentResults)); closeModal();
    });

    info.appendChild(h); info.appendChild(a); info.appendChild(y); info.appendChild(e); info.appendChild(saveBtn); info.appendChild(removeBtn);
    cover.appendChild(imgWrap); cover.appendChild(info);
    modalContent.appendChild(cover);
  }

  function closeModal(){ modal.classList.add('hidden'); }

  if(modalOverlay) modalOverlay.addEventListener('click', closeModal);
  if(modalClose) modalClose.addEventListener('click', closeModal);

  function toggleSave(book){
    if(saved[book.key]){
      // toggle between want/read
      saved[book.key].status = saved[book.key].status === 'read' ? 'want' : 'read';
    } else {
      saved[book.key] = {...book, status:'want'};
    }
    persistSaved();
  }

  function persistSaved(){
    try{localStorage.setItem('booksgalore_saved', JSON.stringify(saved));}catch(e){console.warn('Could not persist saved',e)}
  }

  function loadSaved(){
    try{const v = localStorage.getItem('booksgalore_saved'); return v ? JSON.parse(v) : {}; }catch(e){return {}}
  }

  // View toggles
  if(bookshelfBtn){
    bookshelfBtn.addEventListener('click', ()=>{
      inBookshelf = !inBookshelf;
      if(inBookshelf){
        viewTitle.textContent = 'Your Bookshelf';
        renderResults(Object.values(saved));
      } else {
        viewTitle.textContent = 'Search';
        renderResults(applyFilters(currentResults));
      }
    });
  }

  if(openFilters) openFilters.addEventListener('click', ()=>filtersPanel.classList.add('open'));
  if(toggleFilters) toggleFilters.addEventListener('click', ()=>filtersPanel.classList.remove('open'));

  // Filters change
  [sortByEl, eraEl, hasCoverEl, minEditionsEl].forEach(el=>{
    if(el) el.addEventListener('change', ()=>{
      renderResults(applyFilters(inBookshelf ? Object.values(saved) : currentResults));
    });
  });

  // Debounced search on input
  const debounced = debounce((e)=>{
    const q = e.target.value;
    if(!q) return;
    // respect simple rate: wait 1000ms between calls
    search(q);
  }, 800);

  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      // expand when typing
      if(searchInput.classList.contains('collapsed')){
        searchInput.classList.remove('collapsed');
        searchInput.style.width = '320px';
      }
      debounced(e);
    });

    // Submit on enter
    searchInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        search(searchInput.value);
      }
    });
  }

  // initial focus behavior: clicking outside collapses
  document.addEventListener('click', (e)=>{
    if(searchInput && !searchInput.contains(e.target) && searchInput.value.trim() === ''){
      searchInput.classList.add('collapsed');
      searchInput.style.width='';
    }
  });

  // expose simple global for debugging
  window.booksgalore = {search, saved};

})();
