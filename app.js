/* ============================================================
   Yang Li Portfolio — interactions + EN/中 toggle
   ============================================================ */
(function(){
  'use strict';

  /* ---------- language ---------- */
  const STORE_KEY = 'yl_lang';
  function getLang(){ return localStorage.getItem(STORE_KEY) || 'en'; }
  function applyLang(lang){
    document.body.classList.toggle('lang-cn', lang === 'cn');
    document.documentElement.lang = lang === 'cn' ? 'zh' : 'en';
    document.querySelectorAll('[data-en]').forEach(el=>{
      const val = el.getAttribute(lang === 'cn' ? 'data-cn' : 'data-en');
      if(val !== null) el.innerHTML = val;
    });
    document.querySelectorAll('[data-en-href]').forEach(el=>{
      const href = el.getAttribute(lang === 'cn' ? 'data-cn-href' : 'data-en-href');
      if(href !== null) el.setAttribute('href', href);
    });
    document.querySelectorAll('.lang-toggle span').forEach(s=>{
      s.classList.toggle('active', s.dataset.lang === lang);
    });
    localStorage.setItem(STORE_KEY, lang);
  }
  window.__setLang = applyLang;

  function initLang(){
    applyLang(getLang());
    document.querySelectorAll('.lang-toggle span').forEach(s=>{
      s.addEventListener('click', ()=> applyLang(s.dataset.lang));
    });
  }

  /* ---------- nav scroll state ---------- */
  function initNav(){
    const nav = document.querySelector('.nav');
    const onScroll = ()=> nav.classList.toggle('scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive:true});
  }

  /* ---------- hamburger / mobile panel ---------- */
  function initMenu(){
    const burger = document.querySelector('.hamburger');
    const panel = document.querySelector('.mobile-panel');
    if(!burger || !panel) return;
    const close = ()=>{ burger.classList.remove('open'); panel.classList.remove('open'); document.body.style.overflow=''; };
    burger.addEventListener('click', ()=>{
      const open = burger.classList.toggle('open');
      panel.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    panel.querySelectorAll('a').forEach(a=> a.addEventListener('click', close));
  }

  /* ---------- scroll reveal ---------- */
  function initReveal(){
    const els = document.querySelectorAll('.reveal');
    if(!('IntersectionObserver' in window)){ els.forEach(e=>e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.14, rootMargin:'0px 0px -8% 0px'});
    els.forEach(e=>io.observe(e));
  }

  /* ---------- hero floating sparkles ---------- */
  function initSparkles(){
    const hero = document.querySelector('.hero');
    if(!hero) return;
    const glyphs = ['✦','✧','♡','✦'];
    const spots = [
      {l:'8%',  t:'24%', s:26, d:0},
      {l:'40%', t:'14%', s:18, d:.8},
      {l:'62%', t:'30%', s:22, d:1.6},
      {l:'88%', t:'52%', s:16, d:.4},
      {l:'18%', t:'60%', s:20, d:1.2},
    ];
    spots.forEach((p,i)=>{
      const sp = document.createElement('span');
      sp.className = 'deco';
      sp.textContent = glyphs[i % glyphs.length];
      sp.style.left = p.l; sp.style.top = p.t;
      sp.style.fontSize = p.s + 'px';
      sp.style.animationDelay = p.d + 's';
      hero.appendChild(sp);
    });
  }

  /* ---------- smooth anchor offset for fixed nav ---------- */
  function initAnchors(){
    document.querySelectorAll('a[href^="#"]').forEach(a=>{
      a.addEventListener('click', e=>{
        const id = a.getAttribute('href');
        if(id.length < 2) return;
        const t = document.querySelector(id);
        if(!t) return;
        e.preventDefault();
        const y = t.getBoundingClientRect().top + window.scrollY - 56;
        window.scrollTo({top:y, behavior:'smooth'});
      });
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    initLang();
    initNav();
    initMenu();
    initReveal();
    initSparkles();
    initAnchors();
  });
})();
