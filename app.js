/* ══════════════════════════════════════════════════════════════
   0.01 — the brush
   one hand, one set of marks, used on every page.

   a stroke is not a line of constant width. it is a ribbon that
   swells where the brush pressed and thins where it lifted.
   so: sample the centreline, waver it, give it a pressure profile,
   and emit the outline as bezier curves. pure vector — the taper
   and the ragged edge are geometry, never a raster filter.
   ══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* #rough / #rough2 / #dry survive as pass-throughs so stray refs resolve.
     #wash is a plain blur — the only filter still doing work. */
  var DEFS =
    '<svg class="brush-defs" width="0" height="0" aria-hidden="true" focusable="false" ' +
    'style="position:absolute;pointer-events:none">' +
      '<defs>' +
        '<filter id="rough"><feOffset dx="0" dy="0"/></filter>' +
        '<filter id="rough2"><feOffset dx="0" dy="0"/></filter>' +
        '<filter id="dry"><feOffset dx="0" dy="0"/></filter>' +
        '<filter id="wash" x="-30%" y="-30%" width="160%" height="160%">' +
          '<feGaussianBlur stdDeviation="6"/>' +
        '</filter>' +
      '</defs>' +
    '</svg>';

  var GRAIN =
    '<svg class="grain" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<filter id="grainf"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="4" stitchTiles="stitch"/>' +
      '<feColorMatrix type="saturate" values="0"/></filter>' +
      '<rect width="100%" height="100%" filter="url(#grainf)" opacity=".45"/>' +
    '</svg>';

  /* ── mark library ─────────────────────────────────────────── */
  var RULES = [
    'M6 15C200 5 470 2 700 6c210 4 380 10 494 3-114 14-284 12-494 9C470 15 200 15 6 15z',
    'M10 17C160 6 360 3 520 8c-140 10-330 12-510 12zM560 9c180-2 400 1 634 8-236 6-458 4-634-2z',
    'M4 12C240 4 520 3 760 8c150 3 290 8 436 2-146 13-286 11-436 8C520 13 240 13 4 12z'
  ];

  var SWEEPS = [
    'M4 13C70 5 160 3 240 6c46 2 92 5 156 1-64 12-110 10-156 8-80-4-170-4-236-2z',
    'M6 16C80 3 180 2 268 7c40 3 78 7 126 2-48 14-86 13-126 10-88-7-188-7-262-3z',
    'M4 10C90 3 200 2 300 5c34 1 66 4 96 1-30 10-62 9-96 7-100-4-210-4-296-3z',
    'M8 14C60 8 130 5 196 6c66 1 130 6 196 2-66 12-130 9-196 8-66-1-136 0-188-2z'
  ];

  function ruleMark(i){
    return '<svg viewBox="0 0 1200 26" fill="none" xmlns="' + NS + '" aria-hidden="true">' +
             '<path d="' + RULES[i % RULES.length] + '" fill="var(--ink)" opacity=".62" data-rough=".7"/>' +
           '</svg>';
  }

  function sweepMark(i, w){
    return '<svg viewBox="0 0 400 22" width="' + w + '" fill="none" xmlns="' + NS + '" aria-hidden="true">' +
           '<path d="' + SWEEPS[i % SWEEPS.length] + '" data-rough=".6"/></svg>';
  }

  /* ── deterministic randomness ─────────────────────────────── */
  function rng(seed){
    var s = (seed | 0) || 1;
    return function(){ s = (s * 1103515245 + 12345) % 2147483648; return Math.abs(s) / 2147483648; };
  }

  /* smooth low-frequency noise — a hand wavers, it doesn't buzz */
  function noiseSeq(n, rand, wave){
    var ctrl = [], out = [], m = Math.ceil(n / wave) + 3, i;
    for(i = 0; i < m; i++) ctrl.push(rand() * 2 - 1);
    for(i = 0; i <= n; i++){
      var t = i / wave, k = Math.floor(t), f = t - k;
      var s = f * f * (3 - 2 * f);
      out.push(ctrl[k] * (1 - s) + ctrl[k + 1] * s);
    }
    return out;
  }

  function r2(v){ return Math.round(v * 100) / 100; }

  /* catmull-rom through points, emitted as cubic beziers */
  function toCurve(p, closed){
    var n = p.length, d = 'M' + r2(p[0][0]) + ' ' + r2(p[0][1]), i;
    for(i = 0; i < n - 1; i++){
      var p0 = p[i > 0 ? i - 1 : (closed ? n - 2 : 0)];
      var p1 = p[i], p2 = p[i + 1];
      var p3 = p[i + 2 < n ? i + 2 : (closed ? 1 : n - 1)];
      d += 'C' + r2(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + r2(p1[1] + (p2[1] - p0[1]) / 6) +
           ',' + r2(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + r2(p2[1] - (p3[1] - p1[1]) / 6) +
           ',' + r2(p2[0]) + ' ' + r2(p2[1]);
    }
    return closed ? d + 'Z' : d;
  }

  /* ── pressure ─────────────────────────────────────────────── */
  /* the brush lands, holds, then lifts off to a point */
  function pressure(t){
    var head = 0.09, tail = 0.20;
    if(t < head)      return 0.30 + 0.70 * Math.pow(t / head, 0.55);
    if(t > 1 - tail)  return 0.05 + 0.95 * Math.pow((1 - t) / tail, 0.72);
    return 1;
  }

  function sample(el, n){
    var len = el.getTotalLength(), pts = [], i, p;
    for(i = 0; i <= n; i++){ p = el.getPointAtLength(len * (i / n)); pts.push([p.x, p.y]); }
    return pts;
  }

  function normals(pts, closed){
    var n = pts.length, out = [], i;
    for(i = 0; i < n; i++){
      var a = pts[i > 0 ? i - 1 : (closed ? n - 2 : 0)];
      var b = pts[i < n - 1 ? i + 1 : (closed ? 1 : n - 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1];
      var m = Math.sqrt(tx * tx + ty * ty) || 1;
      out.push([ -ty / m, tx / m ]);
    }
    return out;
  }

  /* ── a stroke becomes a filled ribbon ─────────────────────── */
  function ribbon(el, base, seed, closed){
    var len = el.getTotalLength();
    if(!len || !isFinite(len) || len < 1.5) return null;

    var n = Math.max(10, Math.min(240, Math.round(len / Math.max(1.4, base * 0.75))));
    var rand = rng(seed);

    /* the hand's waver, then two independent edge tremors so the two
       sides of the stroke never run parallel — that is what reads as bristle */
    var wob   = Math.min(base * 0.30, len / 45);
    var jx    = noiseSeq(n, rand, 6),  jy = noiseSeq(n, rand, 6);
    var press = noiseSeq(n, rand, 4);
    var eL    = noiseSeq(n, rand, 2.2), eR = noiseSeq(n, rand, 2.2);

    var pts = sample(el, n), i;
    for(i = 0; i <= n; i++){
      pts[i][0] += jx[i] * wob;
      pts[i][1] += jy[i] * wob;
    }
    if(closed){ pts[n] = [pts[0][0], pts[0][1]]; }

    var nrm = normals(pts, closed);
    var left = [], right = [];

    for(i = 0; i <= n; i++){
      var t = i / n;
      var w = base * (closed ? 1 : pressure(t)) * (1 + 0.24 * press[i]);
      var wl = Math.max(0.04, w * (1 + 0.20 * eL[i])) / 2;
      var wr = Math.max(0.04, w * (1 + 0.20 * eR[i])) / 2;
      left.push([  pts[i][0] + nrm[i][0] * wl, pts[i][1] + nrm[i][1] * wl ]);
      right.push([ pts[i][0] - nrm[i][0] * wr, pts[i][1] - nrm[i][1] * wr ]);
    }

    if(closed){
      right.reverse();
      return toCurve(left, true) + ' ' + toCurve(right, true);
    }
    right.reverse();
    return toCurve(left.concat(right), true);
  }

  /* ── filled shapes just get the waver ─────────────────────── */
  function roughShape(el, amp, seed){
    var len;
    try{ len = el.getTotalLength(); }catch(err){ return el; }
    if(!len || !isFinite(len) || len < 2) return el;

    amp = Math.min(amp, len / 26);
    if(amp < 0.05) return el;

    var n = Math.max(10, Math.min(200, Math.round(len / Math.max(2, amp * 3.5))));
    var rand = rng(seed);
    var nx = noiseSeq(n, rand, 3.4), ny = noiseSeq(n, rand, 3.4);

    var pts = sample(el, n), i;
    for(i = 0; i <= n; i++){ pts[i][0] += nx[i] * amp; pts[i][1] += ny[i] * amp; }
    pts[n] = [pts[0][0], pts[0][1]];

    return swap(el, toCurve(pts, true));
  }

  /* ── element surgery ──────────────────────────────────────── */
  var GEOM = { x:1, y:1, width:1, height:1, rx:1, ry:1, r:1, cx:1, cy:1,
               x1:1, y1:1, x2:1, y2:1, points:1, d:1 };

  function swap(el, d){
    if(el.tagName.toLowerCase() === 'path'){ el.setAttribute('d', d); return el; }
    var out = document.createElementNS(NS, 'path'), i;
    for(i = 0; i < el.attributes.length; i++){
      var a = el.attributes[i];
      if(!GEOM[a.name]) out.setAttribute(a.name, a.value);
    }
    out.setAttribute('d', d);
    el.parentNode.replaceChild(out, el);
    return out;
  }

  var DROP = { ink:1, 'ink-thin':1, 'ink-fat':1, 'ink-clay':1, 'ink-sage':1, 'ink-gold':1,
               draw:1, slow:1 };

  function defsOf(svg){
    var d = svg.querySelector('defs');
    if(!d){ d = document.createElementNS(NS, 'defs'); svg.insertBefore(d, svg.firstChild); }
    return d;
  }

  var maskId = 0;

  function brushify(el, seed){
    var cs = getComputedStyle(el);
    var base = parseFloat(cs.strokeWidth) || 4;
    var colour = cs.stroke && cs.stroke !== 'none' ? cs.stroke : 'currentColor';

    var dAttr = el.getAttribute('d') || '';
    var isPath = el.tagName.toLowerCase() === 'path';
    /* multi-subpath marks can't be resampled as one run — leave them stroked */
    if(isPath && (dAttr.match(/[Mm]/g) || []).length > 1) return;

    var closed = !isPath || /[zZ]\s*$/.test(dAttr.trim());
    var d = ribbon(el, base, seed, closed);
    if(!d) return;

    var wantsDraw = el.classList.contains('draw');
    var slow = el.classList.contains('slow');

    /* the roughened centreline, kept for the paint-on mask */
    var spine = null;
    if(wantsDraw){
      var n = Math.max(10, Math.min(160, Math.round(el.getTotalLength() / Math.max(1.4, base * 0.75))));
      spine = toCurve(sample(el, n), closed);
    }

    var out = swap(el, d);

    var keep = (out.getAttribute('class') || '').split(/\s+/).filter(function(c){
      return c && !DROP[c];
    });
    keep.push('brush');
    out.setAttribute('class', keep.join(' '));
    out.style.fill = colour;
    out.style.stroke = 'none';
    if(closed) out.setAttribute('fill-rule', 'evenodd');

    if(wantsDraw && spine){
      var svg = out.ownerSVGElement;
      if(!svg) return;
      var vb = svg.viewBox.baseVal;
      var id = 'paint' + (++maskId);

      var mp = document.createElementNS(NS, 'path');
      mp.setAttribute('d', spine);
      mp.setAttribute('fill', 'none');
      mp.setAttribute('stroke', '#fff');
      mp.setAttribute('stroke-width', r2(base * 2.6));
      mp.setAttribute('stroke-linecap', 'round');
      mp.setAttribute('stroke-linejoin', 'round');
      mp.setAttribute('class', 'draw' + (slow ? ' slow' : ''));

      var mask = document.createElementNS(NS, 'mask');
      mask.setAttribute('id', id);
      mask.setAttribute('maskUnits', 'userSpaceOnUse');
      if(vb && vb.width){
        mask.setAttribute('x', vb.x - 60);
        mask.setAttribute('y', vb.y - 60);
        mask.setAttribute('width', vb.width + 120);
        mask.setAttribute('height', vb.height + 120);
      }
      mask.appendChild(mp);
      defsOf(svg).appendChild(mask);

      out.setAttribute('mask', 'url(#' + id + ')');
      out.classList.add('draw-host');
      out._spine = mp;
    }
  }

  /* how much waver a filled mark gets, in its own svg's units */
  function ampFor(el){
    var explicit = el.getAttribute('data-rough');
    if(explicit !== null) return parseFloat(explicit);
    var owner = el.ownerSVGElement, w = 400;
    if(owner && owner.viewBox && owner.viewBox.baseVal && owner.viewBox.baseVal.width){
      w = owner.viewBox.baseVal.width;
    }
    return Math.max(0.4, Math.min(2.6, w / 480));
  }

  var RASTER = /#(rough2?|dry)\)/;

  function handwork(){
    var seed = 17;

    /* strokes → tapered ribbons */
    [].slice.call(document.querySelectorAll('.ink')).forEach(function(el){
      try{ brushify(el, seed += 37); }catch(err){}
    });

    /* filled marks → wavered outlines */
    var fills = '.ink-solid, .sweep path, .brush-rule path, [data-rough],' +
                '.fill-clay, .fill-sage, .fill-gold, .fill-paper3';
    [].slice.call(document.querySelectorAll(fills)).forEach(function(el){
      if(el.classList.contains('brush')) return;
      try{
        var kept = roughShape(el, ampFor(el), seed += 37);
        var f = kept.getAttribute('filter');
        if(f && RASTER.test(f)) kept.removeAttribute('filter');
      }catch(err){}
    });

    [].forEach.call(document.querySelectorAll('[filter]'), function(el){
      if(RASTER.test(el.getAttribute('filter'))) el.removeAttribute('filter');
    });
  }

  /* ── flecks: little roughened blobs ───────────────────────── */
  function fleckMark(seed, n){
    var rand = rng(seed), out = '', i, j;
    for(i = 0; i < n; i++){
      var cx = rand() * 100, cy = rand() * 100;
      var rx = 0.9 + rand() * 2.4, o = (0.2 + rand() * 0.4).toFixed(2);
      var sides = 7, pts = [];
      for(j = 0; j < sides; j++){
        var a = (j / sides) * Math.PI * 2;
        var rr = rx * (0.6 + rand() * 0.75);
        pts.push([ r2(Math.cos(a) * rr), r2(Math.sin(a) * rr) ]);
      }
      pts.push([ pts[0][0], pts[0][1] ]);
      out += '<path transform="translate(' + r2(cx) + ' ' + r2(cy) + ')" d="' +
             toCurve(pts, true) + '" fill="var(--ink)" opacity="' + o + '"/>';
    }
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" ' +
           'aria-hidden="true" xmlns="' + NS + '">' + out + '</svg>';
  }

  /* ── washes: an organic blob, softened with css blur ──────── */
  function washMark(colour, seed){
    var rand = rng(seed), pts = [], i, sides = 11;
    for(i = 0; i < sides; i++){
      var a = (i / sides) * Math.PI * 2;
      var rr = 0.62 + rand() * 0.34;
      pts.push([ r2(50 + Math.cos(a) * 46 * rr), r2(50 + Math.sin(a) * 44 * rr) ]);
    }
    pts.push([ pts[0][0], pts[0][1] ]);
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" ' +
           'aria-hidden="true" xmlns="' + NS + '">' +
           '<path d="' + toCurve(pts, true) + '" fill="' + colour + '"/></svg>';
  }

  /* ── build ────────────────────────────────────────────────── */
  function paint(){
    document.body.insertAdjacentHTML('afterbegin', DEFS + GRAIN);

    var i = 0;
    [].forEach.call(document.querySelectorAll('.brush-rule'), function(el){
      el.innerHTML = ruleMark(el.dataset.mark ? +el.dataset.mark : i++);
    });

    var j = 0;
    [].forEach.call(document.querySelectorAll('[data-sweep]'), function(el){
      var w = el.dataset.sweep || '220';
      var variant = el.dataset.mark ? +el.dataset.mark : j++;
      var tone = el.dataset.tone ? ' ' + el.dataset.tone : '';
      el.insertAdjacentHTML('beforeend', '<span class="sweep' + tone + '">' + sweepMark(variant, w) + '</span>');
    });

    [].forEach.call(document.querySelectorAll('.flecks'), function(el){
      el.innerHTML = fleckMark(el.dataset.seed ? +el.dataset.seed : 42,
                               el.dataset.n ? +el.dataset.n : 14);
    });

    var k = 5;
    [].forEach.call(document.querySelectorAll('.wash'), function(el){
      el.innerHTML = washMark(el.dataset.colour || 'var(--gold-soft)', k += 23);
    });
  }

  /* ── motion ───────────────────────────────────────────────── */
  function animate(){
    var show = function(entries, obs){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in'); obs.unobserve(e.target); }
      });
    };

    var io = new IntersectionObserver(show, { threshold:.1, rootMargin:'0px 0px -6% 0px' });
    [].forEach.call(document.querySelectorAll('.reveal, .bloom'), function(el){ io.observe(el); });

    /* the ribbon is masked by its own centreline — reveal that, and the
       stroke appears to be painted on */
    var pio = new IntersectionObserver(function(entries, obs){
      entries.forEach(function(e){
        if(!e.isIntersecting) return;
        var spine = e.target._spine;
        if(spine) spine.classList.add('in');
        obs.unobserve(e.target);
      });
    }, { threshold:.12 });

    [].forEach.call(document.querySelectorAll('.draw-host'), function(el){
      var spine = el._spine;
      if(spine){
        try{
          var len = spine.getTotalLength();
          if(len) spine.style.setProperty('--len', Math.ceil(len));
        }catch(err){}
      }
      pio.observe(el);
    });

    /* anything still stroked (multi-subpath marks) animates directly */
    var dio = new IntersectionObserver(show, { threshold:.15 });
    [].forEach.call(document.querySelectorAll('.draw:not(.brush)'), function(el){
      if(el.parentNode && el.parentNode.tagName.toLowerCase() === 'mask') return;
      try{
        var len = el.getTotalLength();
        if(len) el.style.setProperty('--len', Math.ceil(len));
      }catch(err){}
      dio.observe(el);
    });
  }

  /* ── the full view ────────────────────────────────────────── */
  function gallery(){
    var shots = [].slice.call(document.querySelectorAll('.tile-art.photo img'));
    if(!shots.length) return;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML =
      '<button class="lightbox-close" type="button" aria-label="close">close</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(box);

    var big = box.querySelector('img');
    var cap = box.querySelector('figcaption');
    var shut = box.querySelector('.lightbox-close');
    var came = null;

    function open(src, alt, title, note, from){
      big.src = src;
      big.alt = alt || '';
      cap.innerHTML = '';
      cap.appendChild(document.createTextNode(title || ''));
      if(note){
        var s = document.createElement('span');
        s.textContent = note;
        cap.appendChild(s);
      }
      came = from || null;
      box.classList.add('open');
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.add('held');
      shut.focus();
    }

    function close(){
      box.classList.remove('open');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('held');
      if(came && came.focus) came.focus();
    }

    shots.forEach(function(img){
      var frame = img.closest('.tile-art');
      var tile  = img.closest('.tile');
      var h3    = tile && tile.querySelector('h3');
      var p     = tile && tile.querySelector('.tile-body p');
      if(!frame) return;

      frame.setAttribute('tabindex', '0');
      frame.setAttribute('role', 'button');
      frame.setAttribute('aria-label', 'see ' + (h3 ? h3.textContent : 'this drawing') + ' in full');

      var fire = function(){
        open(img.currentSrc || img.src, img.alt,
             h3 ? h3.textContent : '', p ? p.textContent.trim() : '', frame);
      };

      frame.addEventListener('click', fire);
      frame.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fire(); }
      });
    });

    shut.addEventListener('click', close);
    box.addEventListener('click', function(e){
      if(e.target === box || e.target.tagName === 'FIGURE') close();
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && box.classList.contains('open')) close();
    });
  }

  /* ── nav ──────────────────────────────────────────────────── */
  function nav(){
    var bar = document.querySelector('.nav');
    if(!bar) return;

    /* the host serves /letter as well as /letter.html — compare the bare name */
    var bare = function(p){
      return (p || '').toLowerCase().split(/[?#]/)[0]
        .replace(/^.*\//, '').replace(/\.html$/, '') || 'index';
    };
    var here = bare(location.pathname);

    [].forEach.call(bar.querySelectorAll('.nav-links a'), function(a){
      if(bare(a.getAttribute('href')) === here) a.classList.add('here');
    });

    var onScroll = function(){ bar.classList.toggle('stuck', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive:true });
    onScroll();
  }

  function boot(){ paint(); handwork(); animate(); gallery(); nav(); }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
