/* ============================================================
   Media slots — user uploads photos & adds video links
   - Click a slot toolbar to upload an image from your computer
   - Video slots also accept a link (YouTube / Bilibili / Douyin…)
   - Everything is remembered in the browser (localStorage)
   ============================================================ */
(function(){
  'use strict';

  var IMG_KEY = 'yl_img_';
  var VID_KEY = 'yl_vid_';
  var POS_KEY = 'yl_pos_';
  var VIDFLAG = 'yl_vidflag_';   // marks that a local video blob exists in IndexedDB
  var MAX_DIM = 1600;        // downscale cap so localStorage stays small
  var JPEG_Q  = 0.85;

  function t(en, cn){ return document.body.classList.contains('lang-cn') ? cn : en; }

  /* ============================================================
     IndexedDB — stores uploaded video files (too big for localStorage)
     ============================================================ */
  var DB_NAME = 'yl_media', STORE = 'videos';
  function idbOpen(cb){
    try {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(){ req.result.createObjectStore(STORE); };
      req.onsuccess = function(){ cb(null, req.result); };
      req.onerror   = function(){ cb(req.error); };
    } catch(e){ cb(e); }
  }
  function idbPut(key, blob, cb){
    idbOpen(function(err, db){
      if(err){ cb && cb(err); return; }
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = function(){ cb && cb(null); };
      tx.onerror    = function(){ cb && cb(tx.error); };
    });
  }
  function idbGet(key, cb){
    idbOpen(function(err, db){
      if(err){ cb(err); return; }
      var tx = db.transaction(STORE, 'readonly');
      var r = tx.objectStore(STORE).get(key);
      r.onsuccess = function(){ cb(null, r.result); };
      r.onerror   = function(){ cb(r.error); };
    });
  }
  function idbDel(key, cb){
    idbOpen(function(err, db){
      if(err){ cb && cb(err); return; }
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = function(){ cb && cb(null); };
    });
  }

  /* ---- downscale an image File to a compact data URL ---- */
  function fileToDataURL(file, cb){
    var reader = new FileReader();
    reader.onload = function(){
      var img = new Image();
      img.onload = function(){
        var w = img.width, h = img.height;
        var scale = Math.min(1, MAX_DIM / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(img, 0, 0, cw, ch);
        var type = /png/i.test(file.type) ? 'image/png' : 'image/jpeg';
        try { cb(c.toDataURL(type, JPEG_Q)); }
        catch(e){ cb(reader.result); }
      };
      img.onerror = function(){ cb(reader.result); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function setImage(slot, dataURL){
    var img = slot.querySelector('.slot-img');
    if(!img){
      img = document.createElement('img');
      img.className = 'slot-img';
      img.alt = '';
      slot.insertBefore(img, slot.firstChild);
    }
    img.src = dataURL;
    slot.classList.add('filled');
    applyPos(slot, readPos(slot.dataset.slot));
  }

  /* ---- crop position / zoom ---- */
  function readPos(id){
    try {
      var raw = localStorage.getItem(POS_KEY + id);
      if(raw){ var p = JSON.parse(raw); return {x:clamp(p.x,0,100), y:clamp(p.y,0,100), z:clamp(p.z,1,3)}; }
    } catch(e){}
    return {x:50, y:50, z:1};
  }
  function savePos(id, pos){ localStorage.setItem(POS_KEY + id, JSON.stringify(pos)); }
  function clamp(v, lo, hi){ v = +v; if(isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }
  function applyPos(slot, pos){
    var img = slot.querySelector('.slot-img');
    if(!img) return;
    img.style.objectPosition = pos.x + '% ' + pos.y + '%';
    img.style.transformOrigin = pos.x + '% ' + pos.y + '%';
    img.style.transform = 'scale(' + pos.z + ')';
  }

  function clearImage(slot){
    var img = slot.querySelector('.slot-img');
    if(img) img.remove();
    slot.classList.remove('filled');
  }

  /* ---- local video element ---- */
  function setVideo(slot, blob){
    var v = slot.querySelector('.slot-video');
    if(!v){
      v = document.createElement('video');
      v.className = 'slot-video';
      v.controls = true;
      v.playsInline = true;
      v.preload = 'metadata';
      slot.insertBefore(v, slot.firstChild);
    }
    if(v.dataset.objurl){ try { URL.revokeObjectURL(v.dataset.objurl); } catch(e){} }
    var url = URL.createObjectURL(blob);
    v.src = url;
    v.dataset.objurl = url;
    var posterImg = localStorage.getItem(IMG_KEY + slot.dataset.slot);
    if(posterImg) v.poster = posterImg;
    slot.classList.add('filled', 'has-video');

    /* warn if the browser can't decode this format (e.g. .mov / HEVC) */
    var msg = slot.querySelector('.slot-vmsg');
    if(msg) msg.remove();
    v.onerror = function(){ showVideoMsg(slot, blob); };
    // some browsers don't fire onerror but report no dimensions
    v.onloadeddata = function(){
      if(v.videoWidth === 0 && v.videoHeight === 0){ showVideoMsg(slot, blob); }
    };
  }
  function showVideoMsg(slot, blob){
    if(slot.querySelector('.slot-vmsg')) return;
    var cn = document.body.classList.contains('lang-cn');
    var name = (blob && blob.name) ? blob.name : '';
    var msg = document.createElement('div');
    msg.className = 'slot-vmsg';
    msg.innerHTML = cn
      ? '此视频格式无法在网页中播放<br><small>请转成 MP4（H.264）后重新上传，或改用「视频链接」</small>'
      : "This video format can't play in browsers<br><small>Re-upload as MP4 (H.264), or use a video link instead</small>";
    slot.appendChild(msg);
  }
  function clearVideo(slot){
    var v = slot.querySelector('.slot-video');
    if(v){
      v.onerror = null; v.onloadeddata = null;
      if(v.dataset.objurl){ try { URL.revokeObjectURL(v.dataset.objurl); } catch(e){} }
      v.remove();
    }
    var msg = slot.querySelector('.slot-vmsg');
    if(msg) msg.remove();
    slot.classList.remove('has-video');
    if(!slot.querySelector('.slot-img')) slot.classList.remove('filled');
  }

  /* ---- recognise embeddable video URLs ---- */
  function parseEmbed(url){
    if(!url) return null;
    var m;
    // YouTube
    m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if(m) return {kind:'youtube', id:m[1], embed:'https://www.youtube.com/embed/'+m[1]+'?autoplay=1&rel=0', poster:'https://i.ytimg.com/vi/'+m[1]+'/hqdefault.jpg'};
    // Vimeo
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if(m) return {kind:'vimeo', id:m[1], embed:'https://player.vimeo.com/video/'+m[1]+'?autoplay=1', poster:null};
    // Bilibili — BV id
    m = url.match(/bilibili\.com\/video\/(BV[\w]+)/i);
    if(m) return {kind:'bilibili', id:m[1], embed:'https://player.bilibili.com/player.html?bvid='+m[1]+'&autoplay=1&high_quality=1', poster:null};
    // Instagram — reel / post / tv
    m = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/i);
    if(m) return {kind:'instagram', id:m[1], embed:'https://www.instagram.com/p/'+m[1]+'/embed/', altembed:['reel','tv'], poster:null, noAutoplay:true};
    // TikTok
    m = url.match(/tiktok\.com\/.*?\/video\/(\d+)/i);
    if(m) return {kind:'tiktok', id:m[1], embed:'https://www.tiktok.com/embed/v2/'+m[1], poster:null, noAutoplay:true};
    return null;
  }

  function applyVideoLink(slot, url){
    var play = slot.querySelector('.play');
    var embed = parseEmbed(url);
    // remove any prior embed facade
    var prior = slot.querySelector('.slot-embed');
    if(prior) prior.remove();

    if(url){
      slot.classList.add('has-link');
      slot.dataset.link = url;
      if(play){ play.classList.add('active'); }

      if(embed){
        slot.classList.add('has-embed');
        slot.dataset.embed = embed.embed;
        var facade = document.createElement('div');
        facade.className = 'slot-embed';
        // poster: user's uploaded cover wins; else platform thumbnail (YouTube only)
        var ownCover = localStorage.getItem(IMG_KEY + slot.dataset.slot);
        var poster = ownCover || embed.poster;
        if(poster) facade.style.backgroundImage = 'url("' + poster + '")';
        else facade.classList.add('no-poster');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-embed-play';
        btn.setAttribute('aria-label','Play video');
        btn.innerHTML = '<span>\u25B6</span>';
        facade.appendChild(btn);
        var labels = {youtube:'YouTube', bilibili:'Bilibili', vimeo:'Vimeo', instagram:'Instagram', tiktok:'TikTok'};
        var badge = document.createElement('span');
        badge.className = 'slot-embed-badge';
        badge.textContent = labels[embed.kind] || 'Video';
        facade.appendChild(badge);
        // platforms with no auto-thumbnail: nudge the user to add a cover
        if(!poster && (embed.kind === 'instagram' || embed.kind === 'tiktok')){
          var hint = document.createElement('span');
          hint.className = 'slot-embed-hint';
          hint.textContent = t('▲ Add a cover photo above','▲ 点上方「上传封面」加封面图');
          facade.appendChild(hint);
        }
        slot.insertBefore(facade, slot.firstChild);
        slot.classList.add('filled');
        btn.addEventListener('click', function(e){
          e.preventDefault(); e.stopPropagation();
          var ifr = document.createElement('iframe');
          ifr.className = 'slot-iframe';
          ifr.src = embed.embed;
          ifr.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
          ifr.setAttribute('allowfullscreen','');
          ifr.frameBorder = '0';
          if(embed.kind === 'instagram' || embed.kind === 'tiktok') ifr.scrolling = 'no';
          facade.replaceWith(ifr);
          slot.classList.add('playing');
        });
      } else {
        slot.classList.remove('has-embed');
        delete slot.dataset.embed;
      }
    } else {
      slot.classList.remove('has-link','has-embed','playing');
      delete slot.dataset.link;
      delete slot.dataset.embed;
      if(play){ play.classList.remove('active'); }
    }
  }

  function build(slot){
    var id   = slot.dataset.slot;
    var kind = slot.dataset.kind; // photo | video

    /* hidden file input (lives inside the upload label) */
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.style.display = 'none';
    file.addEventListener('change', function(){
      if(!file.files || !file.files[0]) return;
      fileToDataURL(file.files[0], function(durl){
        try { localStorage.setItem(IMG_KEY + id, durl); }
        catch(e){ alert(t('Image too large to save in the browser — try a smaller one.','图片太大，浏览器存不下，换一张小一点的吧。')); }
        setImage(slot, durl);
        // if there's an embedded video, refresh its poster to the new cover
        if(kind === 'video' && slot.classList.contains('has-embed')){
          applyVideoLink(slot, localStorage.getItem(VID_KEY + id));
        }
        refreshToolbar();
      });
      file.value = '';
    });

    /* toolbar */
    var bar = document.createElement('div');
    bar.className = 'slot-bar';
    slot.appendChild(bar);

    /* photo upload — a real <label> so the file picker opens natively
       (programmatic input.click() can be blocked inside sandboxed iframes) */
    var btnImg = document.createElement('label');
    btnImg.className = 'slot-btn';
    var btnImgTxt = document.createElement('span');
    btnImg.appendChild(file);
    btnImg.appendChild(btnImgTxt);
    bar.appendChild(btnImg);
    btnImg.addEventListener('click', function(e){ e.stopPropagation(); });

    var btnAdjust = document.createElement('button');
    btnAdjust.type = 'button';
    btnAdjust.className = 'slot-btn';
    bar.appendChild(btnAdjust);

    var btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'slot-btn slot-btn-ghost';
    bar.appendChild(btnClear);
    btnClear.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      localStorage.removeItem(IMG_KEY + id);
      localStorage.removeItem(POS_KEY + id);
      slot.classList.remove('adjusting');
      zoomRow.classList.remove('open');
      clearImage(slot);
      // if a baked image ships with the site, fall back to it instead of going blank
      if(slot.dataset.bakedImg){ setImage(slot, slot.dataset.bakedImg); }
      if(kind === 'video' && hasLocalVid){
        idbDel(id);
        localStorage.removeItem(VIDFLAG + id);
        hasLocalVid = false;
        clearVideo(slot);
      }
      if(kind === 'video'){
        localStorage.removeItem(VID_KEY + id);
        if(linkInput) linkInput.value = '';
        applyVideoLink(slot, '');
      }
      refreshToolbar();
    });

    var btnLink, linkRow, linkInput, btnVideo, btnVideoTxt, videoFile;
    var hasLocalVid = localStorage.getItem(VIDFLAG + id) === '1';
    if(kind === 'video'){
      /* video file input — also inside a <label> for native picker */
      videoFile = document.createElement('input');
      videoFile.type = 'file';
      videoFile.accept = 'video/*';
      videoFile.style.display = 'none';
      videoFile.addEventListener('change', function(){
        if(!videoFile.files || !videoFile.files[0]) return;
        var f = videoFile.files[0];
        slot.classList.add('uploading');
        idbPut(id, f, function(err){
          slot.classList.remove('uploading');
          if(err){
            alert(t('Could not save this video in the browser — it may be too large. Try a smaller file or use a video link instead.','这个视频浏览器存不下，可能太大了。换个小一点的文件，或改用视频链接。'));
            return;
          }
          localStorage.setItem(VIDFLAG + id, '1');
          hasLocalVid = true;
          setVideo(slot, f);
          refreshToolbar();
        });
        videoFile.value = '';
      });

      /* upload-video button (label) */
      btnVideo = document.createElement('label');
      btnVideo.className = 'slot-btn';
      btnVideoTxt = document.createElement('span');
      btnVideo.appendChild(videoFile);
      btnVideo.appendChild(btnVideoTxt);
      bar.appendChild(btnVideo);
      btnVideo.addEventListener('click', function(e){ e.stopPropagation(); });

      /* video link */
      btnLink = document.createElement('button');
      btnLink.type = 'button';
      btnLink.className = 'slot-btn';
      bar.appendChild(btnLink);

      linkRow = document.createElement('div');
      linkRow.className = 'slot-linkrow';
      linkInput = document.createElement('input');
      linkInput.type = 'url';
      linkInput.className = 'slot-linkinput';
      linkInput.placeholder = 'https://...';
      var linkSave = document.createElement('button');
      linkSave.type = 'button';
      linkSave.className = 'slot-btn slot-btn-solid';
      linkSave.textContent = t('Save','保存');
      linkRow.appendChild(linkInput);
      linkRow.appendChild(linkSave);
      slot.appendChild(linkRow);

      btnLink.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        linkRow.classList.toggle('open');
        if(linkRow.classList.contains('open')){ linkInput.focus(); }
      });
      function save(){
        var url = linkInput.value.trim();
        if(url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
        if(url){ localStorage.setItem(VID_KEY + id, url); }
        else { localStorage.removeItem(VID_KEY + id); }
        applyVideoLink(slot, url);
        linkRow.classList.remove('open');
        refreshToolbar();
      }
      linkSave.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); save(); });
      linkInput.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); save(); } });
      linkInput.addEventListener('click', function(e){ e.stopPropagation(); });
    }

    /* ---- adjust (drag to reposition + zoom) ---- */
    var pos = readPos(id);
    var hint = document.createElement('div');
    hint.className = 'slot-hint';
    slot.appendChild(hint);
    var zoomRow = document.createElement('div');
    zoomRow.className = 'slot-zoomrow';
    var zoomLabel = document.createElement('span');
    zoomLabel.className = 'slot-zoomlabel';
    var zoomInput = document.createElement('input');
    zoomInput.type = 'range';
    zoomInput.min = '1'; zoomInput.max = '3'; zoomInput.step = '0.01';
    zoomInput.className = 'slot-zoom';
    var zoomDone = document.createElement('button');
    zoomDone.type = 'button';
    zoomDone.className = 'slot-btn slot-btn-solid';
    zoomRow.appendChild(zoomLabel);
    zoomRow.appendChild(zoomInput);
    zoomRow.appendChild(zoomDone);
    slot.appendChild(zoomRow);

    function labelZoom(){ zoomLabel.textContent = '⌕ ' + Math.round(pos.z * 100) + '%'; }

    function enterAdjust(){
      pos = readPos(id);
      zoomInput.value = pos.z;
      labelZoom();
      hint.textContent = t('Drag the photo to reposition','拖动照片调整位置');
      slot.classList.add('adjusting');
      zoomRow.classList.add('open');
      btnAdjust.textContent = t('✓ Done','✓ 完成');
    }
    function exitAdjust(){
      slot.classList.remove('adjusting');
      zoomRow.classList.remove('open');
      btnAdjust.textContent = t('✥ Adjust','✥ 调整位置');
    }
    btnAdjust.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      if(slot.classList.contains('adjusting')) exitAdjust(); else enterAdjust();
    });
    zoomDone.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); exitAdjust(); });
    zoomInput.addEventListener('input', function(e){
      e.stopPropagation();
      pos.z = clamp(zoomInput.value, 1, 3);
      applyPos(slot, pos); savePos(id, pos); labelZoom();
    });
    zoomInput.addEventListener('click', function(e){ e.stopPropagation(); });

    /* drag to reposition while adjusting */
    var dragging = false, sx = 0, sy = 0, spx = 50, spy = 50;
    slot.addEventListener('pointerdown', function(e){
      if(!slot.classList.contains('adjusting')) return;
      if(e.target.closest('.slot-bar') || e.target.closest('.slot-zoomrow')) return;
      dragging = true; sx = e.clientX; sy = e.clientY; spx = pos.x; spy = pos.y;
      slot.setPointerCapture(e.pointerId);
      slot.classList.add('grabbing');
      e.preventDefault();
    });
    slot.addEventListener('pointermove', function(e){
      if(!dragging) return;
      var r = slot.getBoundingClientRect();
      // drag right -> reveal left side -> object-position decreases
      var nx = spx - (e.clientX - sx) / r.width  * 100;
      var ny = spy - (e.clientY - sy) / r.height * 100;
      pos.x = clamp(nx, 0, 100); pos.y = clamp(ny, 0, 100);
      applyPos(slot, pos);
    });
    function endDrag(){ if(dragging){ dragging = false; slot.classList.remove('grabbing'); savePos(id, pos); } }
    slot.addEventListener('pointerup', endDrag);
    slot.addEventListener('pointercancel', endDrag);

    /* clicking the slot body: while adjusting do nothing; else open link or upload */
    slot.addEventListener('click', function(e){
      if(e.target.closest('.slot-bar') || e.target.closest('.slot-linkrow') || e.target.closest('.slot-zoomrow')) return;
      if(slot.classList.contains('adjusting')) return;
      if(e.target.closest('.slot-video')) return;          // let native video controls work
      if(e.target.closest('.slot-embed') || e.target.closest('.slot-iframe')) return; // embedded player handles itself
      if(kind === 'video' && slot.classList.contains('has-video')) return;
      if(kind === 'video' && slot.classList.contains('has-embed')) return; // play happens via facade button
      if(kind === 'video' && slot.dataset.link){
        window.open(slot.dataset.link, '_blank', 'noopener');
      } else {
        file.click();
      }
    });

    /* drag & drop a file straight onto the slot */
    slot.addEventListener('dragover', function(e){ e.preventDefault(); slot.classList.add('dragover'); });
    slot.addEventListener('dragleave', function(e){ if(e.target === slot) slot.classList.remove('dragover'); });
    slot.addEventListener('drop', function(e){
      e.preventDefault(); slot.classList.remove('dragover');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(!f) return;
      if(/^video\//.test(f.type) && kind === 'video'){
        slot.classList.add('uploading');
        idbPut(id, f, function(err){
          slot.classList.remove('uploading');
          if(err){ alert(t('Could not save this video — it may be too large. Use a video link instead.','视频太大存不下，改用视频链接吧。')); return; }
          localStorage.setItem(VIDFLAG + id, '1'); hasLocalVid = true; setVideo(slot, f); refreshToolbar();
        });
      } else if(/^image\//.test(f.type)){
        fileToDataURL(f, function(durl){
          try { localStorage.setItem(IMG_KEY + id, durl); } catch(err){ alert(t('Image too large to save.','图片太大存不下了。')); }
          setImage(slot, durl); refreshToolbar();
        });
      }
    });

    /* restore saved state */
    var savedImg = localStorage.getItem(IMG_KEY + id);
    if(savedImg){
      setImage(slot, savedImg);
    } else if(slot.dataset.bakedImg){
      // ships-with-the-site image; still adjustable, and a user upload overrides it
      setImage(slot, slot.dataset.bakedImg);
      // apply the author's baked-in crop position if there's no user adjustment saved
      if(!localStorage.getItem(POS_KEY + id) && slot.dataset.bakedPos){
        try { applyPos(slot, JSON.parse(slot.dataset.bakedPos)); } catch(e){}
      }
    }
    if(kind === 'video'){
      var savedVid = localStorage.getItem(VID_KEY + id);
      if(savedVid){ linkInput.value = savedVid; applyVideoLink(slot, savedVid); }
      if(hasLocalVid){
        idbGet(id, function(err, blob){
          if(!err && blob){ setVideo(slot, blob); }
          else { localStorage.removeItem(VIDFLAG + id); hasLocalVid = false; }
          refreshToolbar();
        });
      }
    }

    function refreshToolbar(){
      var hasUpload = !!localStorage.getItem(IMG_KEY + id);
      var hasImg = hasUpload || !!slot.querySelector('.slot-img');   // baked image counts too
      var hasLink = kind === 'video' && !!localStorage.getItem(VID_KEY + id);
      var vid = kind === 'video' && hasLocalVid;
      // cover photo: only relevant when there's no local video
      btnImg.style.display = vid ? 'none' : '';
      btnImgTxt.textContent = hasImg ? t('↻ Replace photo','↻ 更换图片') : t('⤒ Upload photo','⤒ 上传图片');
      btnAdjust.style.display = (hasImg && !vid) ? '' : 'none';
      if(!slot.classList.contains('adjusting')) btnAdjust.textContent = t('✥ Adjust','✥ 调整位置');
      if(btnVideo){ btnVideoTxt.textContent = vid ? t('↻ Replace video','↻ 更换视频') : t('⤓ Upload video','⤓ 上传视频'); }
      if(btnLink){ btnLink.textContent = hasLink ? t('✓ Video link','✓ 已加链接') : t('🔗 Video link','🔗 视频链接'); }
      btnClear.style.display = (hasUpload || hasLink || vid) ? '' : 'none';   // can only remove a user upload
      btnClear.textContent = t('Remove','移除');
      var lbl = slot.querySelector('.ph-label');
      if(lbl) lbl.style.display = (hasImg || vid) ? 'none' : '';
    }
    slot.__refreshToolbar = refreshToolbar;
    refreshToolbar();
  }

  document.addEventListener('DOMContentLoaded', function(){
    // one-time cleanup: user asked to drop the proj5 Instagram link
    try {
      if(!localStorage.getItem('yl_migr_noig') ){
        var v = localStorage.getItem('yl_vid_proj5') || '';
        if(/instagram\.com/i.test(v)){ localStorage.removeItem('yl_vid_proj5'); }
        localStorage.setItem('yl_migr_noig','1');
      }
      // user switched to a new baked English résumé — drop any old browser upload so the new file shows
      if(!localStorage.getItem('yl_migr_enresume')){
        localStorage.removeItem('yl_resumeflag_en');
        localStorage.removeItem('yl_resumename_en');
        try { idbDel('resume-en'); } catch(e){}
        localStorage.setItem('yl_migr_enresume','1');
      }
      // baked CN résumé now ships with the site — drop the old browser upload
      if(!localStorage.getItem('yl_migr_cnresume')){
        localStorage.removeItem('yl_resumeflag_cn');
        localStorage.removeItem('yl_resumename_cn');
        try { idbDel('resume-cn'); } catch(e){}
        localStorage.setItem('yl_migr_cnresume','1');
      }
      // new baked hero photo ships with the site — drop the old browser upload + its saved crop
      if(!localStorage.getItem('yl_migr_hero2')){
        localStorage.removeItem('yl_img_hero');
        localStorage.removeItem('yl_pos_hero');
        localStorage.setItem('yl_migr_hero2','1');
      }
      // baked About photos now ship with the site — drop old browser uploads (keep crops cleared so baked shows fresh)
      if(!localStorage.getItem('yl_migr_about2')){
        ['about1','about2','about3'].forEach(function(a){
          localStorage.removeItem('yl_img_' + a);
          localStorage.removeItem('yl_pos_' + a);
        });
        localStorage.setItem('yl_migr_about2','1');
      }
    } catch(e){}
    // baked-in published videos take precedence — skip the upload UI for them
    document.querySelectorAll('.media-slot').forEach(function(sl){
      if(sl.classList.contains('has-baked')) return;
      build(sl);
    });
    initSocials();
    initResume();
    // re-label toolbar text when language flips
    document.querySelectorAll('.lang-toggle span').forEach(function(s){
      s.addEventListener('click', function(){
        setTimeout(function(){
          document.querySelectorAll('.media-slot').forEach(function(sl){ if(sl.__refreshToolbar) sl.__refreshToolbar(); });
          document.querySelectorAll('.resume-slot').forEach(function(sl){ if(sl.__refreshResume) sl.__refreshResume(); });
        }, 0);
      });
    });
  });

  /* ============================================================
     Résumé upload (PDF stored in IndexedDB)
     ============================================================ */
  function initResume(){
    document.querySelectorAll('.resume-slot').forEach(function(slot){
      var which = slot.dataset.resume;           // 'en' | 'cn'
      var key = 'resume-' + which;
      var flagKey = 'yl_resumeflag_' + which;
      var nameKey = 'yl_resumename_' + which;
      var input = slot.querySelector('input[type=file]');
      var dl = slot.querySelector('.resume-download');
      var rm = slot.querySelector('.resume-remove');
      var status = slot.querySelector('.resume-status');
      var upTxt = slot.querySelector('.resume-upload-txt');
      var baked = slot.dataset.baked || null;        // baked-in file shipped with the site
      var bakedName = slot.dataset.bakedName || 'resume.pdf';
      var objurl = null;

      function refresh(){
        var hasUpload = localStorage.getItem(flagKey) === '1';
        var has = hasUpload || !!baked;
        var cn = document.body.classList.contains('lang-cn');
        slot.classList.toggle('filled', has);
        dl.style.display = has ? '' : 'none';
        rm.style.display = hasUpload ? '' : 'none';   // can only remove a user upload, not the baked file
        if(upTxt) upTxt.textContent = has ? (cn ? '↻ 更换' : '↻ Replace') : (cn ? '⤒ 上传 PDF' : '⤒ Upload PDF');
        if(hasUpload){
          status.textContent = localStorage.getItem(nameKey) || 'résumé.pdf';
        } else if(baked){
          status.textContent = status.getAttribute(cn ? 'data-cn' : 'data-en') || (cn ? '已就绪 ✓' : 'Ready ✓');
        } else {
          status.textContent = status.getAttribute(cn ? 'data-empty-cn' : 'data-empty-en') || (cn ? '还没有文件' : 'No file yet');
        }
      }
      slot.__refreshResume = refresh;

      function load(){
        idbGet(key, function(err, blob){
          if(err || !blob){ return; }
          if(objurl){ try{ URL.revokeObjectURL(objurl); }catch(e){} }
          objurl = URL.createObjectURL(blob);
          dl.href = objurl;
          var nm = localStorage.getItem(nameKey) || 'resume.pdf';
          dl.setAttribute('download', nm);
        });
      }

      input.addEventListener('change', function(){
        if(!input.files || !input.files[0]) return;
        var f = input.files[0];
        if(f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)){
          alert(t('Please choose a PDF file.','请选择 PDF 文件。'));
          input.value = ''; return;
        }
        idbPut(key, f, function(err){
          if(err){ alert(t('Could not save this file — it may be too large.','文件太大，存不下了。')); return; }
          localStorage.setItem(flagKey, '1');
          localStorage.setItem(nameKey, f.name);
          load(); refresh();
        });
        input.value = '';
      });

      rm.addEventListener('click', function(){
        idbDel(key);
        localStorage.removeItem(flagKey);
        localStorage.removeItem(nameKey);
        if(objurl){ try{ URL.revokeObjectURL(objurl); }catch(e){} objurl = null; }
        // fall back to the baked file if there is one
        if(baked){ dl.href = baked; dl.setAttribute('download', bakedName); }
        else { dl.removeAttribute('href'); }
        refresh();
      });

      if(localStorage.getItem(flagKey) === '1') load();
      refresh();
    });
  }

  /* ============================================================
     Editable social links (Contact)
     ============================================================ */
  function initSocials(){
    var SOC_KEY = 'yl_social_';
    var editor = document.getElementById('social-editor');
    if(!editor) return;
    var label  = editor.querySelector('.se-label');
    var input  = editor.querySelector('.se-input');
    var saveBtn= editor.querySelector('.se-save');
    var cancel = editor.querySelector('.se-cancel');
    var current = null;

    function linkFor(pill){
      var key = pill.dataset.social;
      var saved = localStorage.getItem(SOC_KEY + key);
      return saved || pill.dataset.default || '';
    }
    function applyPill(pill){
      var url = linkFor(pill);
      if(url){
        pill.classList.add('has-link');
        pill.dataset.link = url;
        // set up native navigation so clicks aren't popup-blocked
        pill.setAttribute('href', url);
        if(/^mailto:/i.test(url)){
          pill.removeAttribute('target');
          pill.removeAttribute('rel');
        } else {
          pill.setAttribute('target','_blank');
          pill.setAttribute('rel','noopener noreferrer');
        }
      } else {
        pill.classList.remove('has-link');
        delete pill.dataset.link;
        pill.removeAttribute('href');
        pill.removeAttribute('target');
        pill.removeAttribute('rel');
      }
    }
    function openEditor(pill){
      current = pill;
      var name = pill.querySelector('span') ? pill.querySelector('span').textContent.trim() : pill.dataset.social;
      label.textContent = name;
      input.value = localStorage.getItem(SOC_KEY + pill.dataset.social) || pill.dataset.default || '';
      editor.classList.add('open');
      input.focus();
    }
    function closeEditor(){ editor.classList.remove('open'); current = null; }
    function save(){
      if(!current) return;
      var url = input.value.trim();
      var key = current.dataset.social;
      if(url && !/^(https?:|mailto:)/i.test(url)){
        url = (key === 'email' ? 'mailto:' : 'https://') + url;
      }
      if(url) localStorage.setItem(SOC_KEY + key, url);
      else    localStorage.removeItem(SOC_KEY + key);
      applyPill(current);
      closeEditor();
    }

    document.querySelectorAll('.social').forEach(function(pill){
      applyPill(pill);
      pill.addEventListener('click', function(e){
        // pencil → open editor, never navigate
        if(e.target.closest('.social-edit')){ e.preventDefault(); openEditor(pill); return; }
        // no link yet → open editor instead of a dead navigation
        if(!pill.dataset.link){ e.preventDefault(); openEditor(pill); }
        // otherwise: let the native <a href> handle the jump
      });
    });
    saveBtn.addEventListener('click', save);
    cancel.addEventListener('click', closeEditor);
    input.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); save(); }
      else if(e.key === 'Escape'){ closeEditor(); }
    });
  }
})();
