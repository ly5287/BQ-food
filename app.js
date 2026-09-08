/* 今天吃什么 · 转盘
 * 选项数据来自 foods.js（window.FOOD_DATA），分类 -> [{name, sub, desc}]
 */
(function () {
  'use strict';

  var DATA = window.FOOD_DATA || {};
  var CATS = Object.keys(DATA);

  var canvas = document.getElementById('wheel');
  var ctx = canvas.getContext('2d');
  var tabsEl = document.getElementById('tabs');
  var metaEl = document.getElementById('meta');
  var cardEl = document.getElementById('readoutCard');
  var readoutEl = document.getElementById('readout');
  var readoutLabelEl = document.getElementById('readoutLabel');
  var readoutSubEl = document.getElementById('readoutSub');
  var readoutHintEl = document.getElementById('readoutHint');
  var btn = document.getElementById('spinBtn');
  var listEl = document.getElementById('list');
  var listCountEl = document.getElementById('listCount');
  var drawer = document.getElementById('drawer');
  var drawerMask = document.getElementById('drawerMask');
  var drawerToggle = document.getElementById('drawerToggle');
  var drawerClose = document.getElementById('drawerClose');
  var modalMask = document.getElementById('modalMask');
  var modalTitle = document.getElementById('modalTitle');
  var modalCat = document.getElementById('modalCat');
  var modalBody = document.getElementById('modalBody');
  var modalClose = document.getElementById('modalClose');
  var modalAgain = document.getElementById('modalAgain');

  var selected = {};          // 分类 -> 是否选中（多选）
  var items = [];             // 当前选项池
  var rot = 0;                // 当前旋转角度（度，顺时针）
  var spinning = false;
  var raf = null;
  var anim = null;
  var lastIdx = -1;
  var started = false;        // 是否已开始转过（未开始时读数区保持空白）
  var result = null;          // 停止后的结果项
  var size = 0;

  /* ---------- 分类多选 ---------- */
  function buildTabs() {
    CATS.forEach(function (c) {
      selected[c] = true;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab on';
      b.textContent = c + '(' + DATA[c].length + ')';
      b.addEventListener('click', function () { toggleCat(c, b); });
      tabsEl.appendChild(b);
    });
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'tab act';
    all.textContent = '全选';
    all.addEventListener('click', function () { selectAll(true); });
    tabsEl.appendChild(all);
  }

  function toggleCat(c, btnEl) {
    var picked = pickedCats();
    if (selected[c] && picked.length === 1) return;   // 至少保留一类
    selected[c] = !selected[c];
    btnEl.classList.toggle('on', selected[c]);
    rebuildPool();
  }

  function selectAll() {
    CATS.forEach(function (c) { selected[c] = true; });
    Array.prototype.forEach.call(tabsEl.children, function (el, i) {
      if (i < CATS.length) el.classList.add('on');
    });
    rebuildPool();
  }

  function pickedCats() {
    return CATS.filter(function (c) { return selected[c]; });
  }

  function rebuildPool() {
    if (spinning) stopSpin();
    items = [];
    pickedCats().forEach(function (c) {
      (DATA[c] || []).forEach(function (it) {
        items.push({
          name: it.name, mid: it.mid || '', sub: it.sub || '',
          desc: it.desc || '', cat: c
        });
      });
    });
    rot = 0;
    lastIdx = -1;
    started = false;
    result = null;
    setClickable(false);
    clearReadout();
    metaEl.textContent = '已选 ' + pickedCats().length + ' 类 · 共 ' + items.length + ' 项';
    draw();
    updateReadout();
    renderList();
  }

  function renderList() {
    listCountEl.textContent = items.length;
    listEl.innerHTML = '';
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      var s = document.createElement('span');
      s.className = 'chip';
      s.textContent = it.name;
      frag.appendChild(s);
    });
    listEl.appendChild(frag);
  }

  /* ---------- 绘制 ---------- */
  function resize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    size = Math.round(rect.width);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // 蓝色系，色相只在一小段内浮动，靠明暗交替区分相邻扇区
  function colorOf(i, n) {
    var hue = 203 + (i % 4) * 4;
    var sat = 52 + (i % 3) * 7;
    var light = (i % 2 === 0) ? 72 : 60;
    if (i === n - 1 && n > 2 && hue === 203 && light === 72) light = 64;
    return 'hsl(' + hue + ',' + sat + '%,' + light + '%)';
  }

  function draw() {
    var n = items.length;
    if (!n || !size) return;
    var c = size / 2;
    var R = size / 2 - 4;
    ctx.clearRect(0, 0, size, size);
    if (!n) return;

    var seg = (Math.PI * 2) / n;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(rot * Math.PI / 180);

    for (var i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, i * seg, (i + 1) * seg);
      ctx.closePath();
      ctx.fillStyle = colorOf(i, n);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawLabel(items[i].name, (i + 0.5) * seg, R, seg, rot);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(c, c, R - 2, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  function drawLabel(text, mid, R, seg, rotationDeg) {
    var outer = R * 0.90;
    var inner = R * 0.30;
    var maxLen = outer - inner;
    if (maxLen <= 8) return;

    var fs = Math.max(11, Math.min(17, R * 0.075));
    ctx.font = '600 ' + fs + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    var w = ctx.measureText(text).width;

    if (w > maxLen) {                       // 径向放不下 -> 缩字号
      fs = fs * maxLen / w;
      if (fs < 9) return;                   // 太小就不显示
      setFont(fs);
      w = ctx.measureText(text).width;
    }

    var rMid = outer - w / 2;
    var arc = seg * rMid;                   // 该处可用弧长
    var need = fs * 1.18;
    if (arc < need) {                       // 扇区太窄 -> 再缩，仍不够则隐去
      var fs2 = fs * arc / need;
      if (fs2 < 9) return;
      fs = Math.max(9, fs2);
      setFont(fs);
    }

    ctx.save();
    ctx.rotate(mid);
    var screenDeg = (rotationDeg + mid * 180 / Math.PI) % 360;
    if (Math.cos(screenDeg * Math.PI / 180) < 0) {   // 左半边翻转，避免倒置
      ctx.rotate(Math.PI);
      ctx.textAlign = 'left';
      ctx.fillText(text, -outer, 0);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(text, outer, 0);
    }
    ctx.restore();
    ctx.textAlign = 'left';
  }

  function setFont(fs) {
    ctx.font = '600 ' + fs.toFixed(1) + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  }

  /* ---------- 指针读数 ---------- */
  function indexAtPointer() {
    var n = items.length;
    if (!n) return -1;
    var segDeg = 360 / n;
    var local = ((270 - rot) % 360 + 360) % 360;
    return Math.floor(local / segDeg) % n;
  }

  // 分类 · 中类 · 小类（空的层级自动跳过）
  function labelOf(it) {
    return [it.cat, it.mid, it.sub].filter(function (s) { return s; }).join(' · ');
  }

  function clearReadout() {
    readoutLabelEl.textContent = '';
    readoutEl.textContent = '';
    readoutSubEl.textContent = '';
  }

  function updateReadout() {
    if (!started) return;
    var idx = indexAtPointer();
    if (idx < 0) return;
    if (idx !== lastIdx) {
      lastIdx = idx;
      var it = items[idx];
      readoutEl.textContent = it.name;
      readoutSubEl.textContent = labelOf(it);
      if (spinning) {
        readoutEl.classList.add('tick');
        setTimeout(function () { readoutEl.classList.remove('tick'); }, 90);
      }
    }
  }

  function setClickable(on) {
    cardEl.classList.toggle('clickable', !!on);
    readoutHintEl.style.visibility = on ? 'visible' : 'hidden';  // 保留占位，卡片高度不变
  }

  /* ---------- 转动 ---------- */
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  function spin() {
    if (spinning) { stopSpin(); return; }
    var n = items.length;
    if (!n) return;

    var idx = Math.floor(Math.random() * n);
    var segDeg = 360 / n;
    var targetLocal = (idx + 0.5) * segDeg + (Math.random() - 0.5) * segDeg * 0.6;
    var delta = (((270 - targetLocal - rot) % 360) + 360) % 360;
    var total = 360 * (4 + Math.floor(Math.random() * 3)) + delta;

    anim = { from: rot, total: total, start: performance.now(), dur: 4200 };
    spinning = true;
    started = true;
    lastIdx = -1;
    result = null;
    setClickable(false);
    readoutLabelEl.textContent = '指针现在指向';
    btn.textContent = '停止';
    btn.classList.add('spinning');
    step();
  }

  function step() {
    var now = performance.now();
    var t = Math.min(1, (now - anim.start) / anim.dur);
    rot = anim.from + anim.total * easeOutQuart(t);
    draw();
    updateReadout();
    if (t < 1) raf = requestAnimationFrame(step);
    else finish();
  }

  // 提前收尾：剩余行程压缩到 500ms
  function stopSpin() {
    if (!spinning || !anim) return;
    cancelAnimationFrame(raf);
    var now = performance.now();
    var t = Math.min(1, (now - anim.start) / anim.dur);
    var done = anim.total * easeOutQuart(t);
    anim.from = anim.from + done;
    anim.total = Math.max(1, anim.total - done);
    anim.start = now;
    anim.dur = 500;
    raf = requestAnimationFrame(step);
  }

  function finish() {
    spinning = false;
    anim = null;
    btn.textContent = '再来一次';
    btn.classList.remove('spinning');
    var idx = indexAtPointer();
    if (idx < 0) return;
    result = items[idx];
    readoutLabelEl.textContent = '今天吃';
    setClickable(true);
  }

  /* ---------- 结果弹窗 ---------- */
  function placeholder(name) {
    return '这里是「' + name + '」的介绍占位。\n\n'
      + '后续你会把每个食物对应的文案整理进表格，我导入后会自动填到这里。\n'
      + '文字较长时，这个区域可以上下滑动查看。';
  }

  function openModal() {
    if (!result) return;
    modalTitle.textContent = result.name;
    modalCat.textContent = labelOf(result);
    modalBody.textContent = result.desc || placeholder(result.name);
    modalMask.hidden = false;
    modalBody.scrollTop = 0;
  }

  function closeModal() { modalMask.hidden = true; }

  /* ---------- 右侧抽屉 ---------- */
  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    drawerMask.hidden = false;
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawerMask.hidden = true;
  }

  /* ---------- 初始化 ---------- */
  buildTabs();
  resize();
  rebuildPool();

  btn.addEventListener('click', spin);
  cardEl.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalMask.addEventListener('click', function (e) { if (e.target === modalMask) closeModal(); });
  modalAgain.addEventListener('click', function () { closeModal(); spin(); });
  drawerToggle.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  drawerMask.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeModal();
    closeDrawer();
  });

  window.addEventListener('resize', function () {
    clearTimeout(window.__rt);
    window.__rt = setTimeout(resize, 120);
  });
})();
