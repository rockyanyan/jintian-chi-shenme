/* ================= 今天吃什么 · 逻辑 ================= */
(function () {
  "use strict";

  const STORE_KEY = "jtcse_v1";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const state = {
    picked: new Set(),
    favs: [],
    filter: "ready",
    tab: "pick",
    keyword: ""
  };

  /* ---------- 本地存储 ---------- */
  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ picked: Array.from(state.picked), favs: state.favs })
      );
    } catch (e) { /* 忽略 */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Array.isArray(d.picked)) d.picked.forEach((k) => INGREDIENTS[k] && state.picked.add(k));
      if (Array.isArray(d.favs)) state.favs = d.favs.filter((id) => RECIPES.some((r) => r.id === id));
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 小组件 ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1600);
  }
  function ingName(k) {
    return INGREDIENTS[k] ? INGREDIENTS[k][0] : k;
  }
  function ingEmo(k) {
    return INGREDIENTS[k] ? INGREDIENTS[k][1] : "🍴";
  }
  const LV = { 1: "新手", 2: "简单", 3: "要耐心" };

  /* ---------- 匹配计算 ---------- */
  function matchOf(r) {
    const req = r.ing.filter((i) => i[0][0] !== "*");
    const owned = req.filter((i) => state.picked.has(i[0]));
    const missing = req.filter((i) => !state.picked.has(i[0]));
    const pct = req.length ? owned.length / req.length : 0;
    return { req, owned, missing, pct, ready: missing.length === 0 };
  }
  function listFor(filter) {
    const arr = RECIPES.map((r) => ({ r, m: matchOf(r) }));
    let out;
    if (filter === "ready") out = arr.filter((x) => x.m.ready);
    else if (filter === "near") out = arr.filter((x) => !x.m.ready && x.m.pct >= 0.5);
    else out = arr;
    out.sort((a, b) => {
      if (b.m.pct !== a.m.pct) return b.m.pct - a.m.pct;
      if (a.m.missing.length !== b.m.missing.length) return a.m.missing.length - b.m.missing.length;
      return a.r.time - b.r.time;
    });
    return out;
  }

  /* ---------- 首页：食材选择 ---------- */
  function renderIngredients() {
    const box = $("#ingList");
    const kw = state.keyword.trim();
    const groups = {};
    Object.keys(INGREDIENTS).forEach((k) => {
      const [n, e, g] = INGREDIENTS[k];
      if (kw && n.indexOf(kw) === -1) return;
      (groups[g] = groups[g] || []).push(k);
    });
    const order = ["蔬菜", "肉蛋", "水产", "豆制品", "主食"];
    let html = "";
    order.forEach((g) => {
      if (!groups[g] || !groups[g].length) return;
      html += '<div class="group-title">' + g + "</div><div class='ing-grid'>";
      groups[g].forEach((k) => {
        const on = state.picked.has(k) ? " on" : "";
        html +=
          '<button class="ing-chip' + on + '" data-k="' + k + '">' +
          '<span class="emo">' + INGREDIENTS[k][1] + "</span>" +
          "<span>" + INGREDIENTS[k][0] + "</span></button>";
      });
      html += "</div>";
    });
    if (!html) {
      html = '<div class="empty-hint"><span class="big">🤔</span>没找到「' + kw + "」<br>换个说法试试，比如「土豆」</div>";
    }
    box.innerHTML = html;
  }

  function renderPicked() {
    const n = state.picked.size;
    $("#pickedCount").textContent = n;
    const list = $("#pickedList");
    if (!n) {
      list.innerHTML = '<span class="picked-empty">还没选食材，点下面的按钮挑几样吧</span>';
    } else {
      list.innerHTML = Array.from(state.picked)
        .map((k) => '<span class="picked-tag">' + ingEmo(k) + " " + ingName(k) + "</span>")
        .join("");
    }
    $("#goCook").disabled = n === 0;
  }

  /* ---------- 第二页：能做什么 ---------- */
  function renderRecipes() {
    const items = listFor(state.filter);
    const box = $("#recipeList");

    if (state.picked.size === 0) {
      $("#cookTitle").textContent = "先告诉我你有啥";
      $("#cookSub").textContent = "回到「我的食材」选几样，这里就会出现能做的菜";
      box.innerHTML =
        '<div class="empty-hint"><span class="big">🧺</span>冰箱里的东西选一选<br>我保证不让你做黑暗料理</div>';
      return;
    }

    const readyCount = listFor("ready").length;
    $("#cookTitle").textContent = "能做 " + readyCount + " 道菜";
    $("#cookSub").textContent =
      state.picked.size + " 样食材 · 调料默认家里有 · 按匹配度排序";

    if (!items.length) {
      box.innerHTML =
        '<div class="empty-hint"><span class="big">🥲</span>暂时没有完全匹配的菜<br>点「全部菜谱」看看差在哪一步</div>';
      return;
    }

    box.innerHTML = items
      .map(({ r, m }) => {
        const badge = m.ready
          ? '<span class="rc-badge badge-ready">就能做</span>'
          : m.pct >= 0.5
          ? '<span class="rc-badge badge-near">差 ' + m.missing.length + " 样</span>"
          : '<span class="rc-badge badge-far">-' + m.missing.length + " 样</span>";
        const ingTxt = r.ing
          .map((i) => {
            const opt = i[0][0] === "*";
            const k = opt ? i[0].slice(1) : i[0];
            const miss = !opt && !state.picked.has(k);
            return miss ? '<span class="miss">' + ingName(k) + "</span>" : ingName(k);
          })
          .join("、");
        return (
          '<div class="recipe-card" data-id="' + r.id + '">' +
          '<div class="rc-emo">' + r.emo + "</div>" +
          '<div class="rc-main">' +
          '<div class="rc-top"><h3 class="rc-name">' + r.n + "</h3>" + badge + "</div>" +
          '<div class="rc-meta"><span>⏱ ' + r.time + " 分钟</span><span>👨‍🍳 " + LV[r.lv] + "</span></div>" +
          '<div class="rc-ings">' + ingTxt + "</div>" +
          "</div>" +
          '<div class="rc-arrow">›</div>' +
          "</div>"
        );
      })
      .join("");
  }

  /* ---------- 详情 ---------- */
  let currentRecipe = null;

  function openDetail(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return;
    currentRecipe = r;
    const m = matchOf(r);
    const isFav = state.favs.indexOf(r.id) > -1;

    let ingHtml = r.ing
      .map((i) => {
        const opt = i[0][0] === "*";
        const k = opt ? i[0].slice(1) : i[0];
        const miss = !opt && !state.picked.has(k);
        return (
          '<div class="ing-line' + (miss ? " miss" : "") + '">' +
          '<span class="dot">' + (miss ? "✕" : "✓") + "</span>" +
          '<span class="nm">' + ingName(k) + (opt ? "（可选）" : "") + "</span>" +
          '<span class="qt">' + i[1] + "</span></div>"
        );
      })
      .join("");

    const stepsHtml = r.steps
      .map(
        (s, i) =>
          '<div class="step" data-step="' + i + '"><div class="num">' + (i + 1) +
          '</div><div class="txt">' + s + "</div></div>"
      )
      .join("");

    const siteLinks = SITES.map(
      (s) =>
        '<a class="site-link" href="' + s.u + encodeURIComponent(r.n) + '">' +
        s.n + " 上看这道菜 ›</a>"
    ).join("");

    const missTip = m.ready
      ? '<div class="tip-box" style="margin-bottom:12px">✅ 你的食材够做这道菜了，开火吧！</div>'
      : '<div class="tip-box" style="margin-bottom:12px">🛒 还差 <b>' +
        m.missing.map((i) => ingName(i[0])).join("、") +
        "</b>，买回来就能做。</div>";

    $("#detailScroll").innerHTML =
      '<div class="detail-hero">' +
      '<button class="back-btn" id="closeDetail">‹</button>' +
      '<div class="hero-emo">' + r.emo + "</div>" +
      '<div class="hero-text"><h2>' + r.n + "</h2>" +
      '<div class="meta">⏱ ' + r.time + " 分钟 · 👨‍🍳 " + LV[r.lv] + " · " +
      (r.tags || []).join(" · ") + "</div></div></div>" +
      missTip +
      '<div class="section"><h3>🧺 食材 <span class="hint">' + r.ing.length + " 样</span></h3>" +
      ingHtml +
      '<div class="ing-line" style="border-top:1px dashed #F4EBE1;margin-top:4px">' +
      '<span class="dot">🧂</span><span class="nm">调料</span>' +
      '<span class="qt">' + r.sea.join("、") + "</span></div></div>" +
      '<div class="section"><h3>👨‍🍳 做法 <span class="hint">点一下可以划掉</span></h3>' +
      stepsHtml + "</div>" +
      '<div class="section" style="background:none;border:none;padding:0">' +
      '<div class="tip-box"><b>小贴士：</b>' + r.tip + "</div></div>" +
      '<div class="section"><h3>🔗 想看更多做法</h3><div class="site-row">' + siteLinks + "</div></div>" +
      '<div style="text-align:center;font-size:11.5px;color:#B6A79A;padding:6px 20px 20px;line-height:1.7">' +
      "菜谱内容为本地整理版本，图片/视频步骤请点上面的网站查看<br>灵感来自「食用手册」等开源菜谱站</div>" +
      '<div class="detail-actions">' +
      '<button class="fav-btn' + (isFav ? " on" : "") + '" id="favBtn">' + (isFav ? "⭐" : "☆") + "</button>" +
      '<button class="primary-btn" id="doneBtn">开做！步骤一步步来</button>' +
      "</div>";

    const page = $("#detailPage");
    page.classList.add("open");
    $("#detailScroll").scrollTop = 0;

    $("#closeDetail").onclick = closeDetail;
    $("#favBtn").onclick = function () {
      toggleFav(r.id);
      const on = state.favs.indexOf(r.id) > -1;
      this.classList.toggle("on", on);
      this.textContent = on ? "⭐" : "☆";
      toast(on ? "已收藏" : "已取消收藏");
    };
    $("#doneBtn").onclick = function () {
      $("#detailScroll").scrollTo({ top: 260, behavior: "smooth" });
    };
    $$("#detailScroll .step").forEach((el) => {
      el.onclick = function () {
        this.style.opacity = this.style.opacity === "0.38" ? "1" : "0.38";
      };
    });
  }

  function closeDetail() {
    $("#detailPage").classList.remove("open");
    currentRecipe = null;
    if (state.tab === "fav") renderFavs();
  }

  /* ---------- 收藏 ---------- */
  function toggleFav(id) {
    const i = state.favs.indexOf(id);
    if (i > -1) state.favs.splice(i, 1);
    else state.favs.unshift(id);
    save();
    if (state.tab === "fav") renderFavs();
  }
  function renderFavs() {
    const box = $("#favList");
    const list = state.favs.map((id) => RECIPES.find((r) => r.id === id)).filter(Boolean);
    if (!list.length) {
      box.innerHTML =
        '<div class="empty-hint"><span class="big">⭐</span>还没有收藏的菜<br>在菜谱页点右上角的星星</div>';
      return;
    }
    box.innerHTML = list
      .map((r) => {
        const m = matchOf(r);
        return (
          '<div class="recipe-card" data-id="' + r.id + '">' +
          '<div class="rc-emo">' + r.emo + "</div>" +
          '<div class="rc-main"><div class="rc-top"><h3 class="rc-name">' + r.n + "</h3>" +
          (m.ready
            ? '<span class="rc-badge badge-ready">就能做</span>'
            : '<span class="rc-badge badge-far">缺 ' + m.missing.length + "</span>") +
          '</div><div class="rc-meta"><span>⏱ ' + r.time + " 分钟</span><span>👨‍🍳 " + LV[r.lv] +
          '</span></div><div class="rc-ings">' +
          r.ing.map((i) => ingName(i[0][0] === "*" ? i[0].slice(1) : i[0])).join("、") +
          "</div></div><div class='rc-arrow'>›</div></div>"
        );
      })
      .join("");
  }

  /* ---------- 切换页面 ---------- */
  function switchTab(tab) {
    state.tab = tab;
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $("#screen-" + tab).classList.add("active");
    $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    if (tab === "cook") renderRecipes();
    if (tab === "fav") renderFavs();
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $("#ingList").addEventListener("click", function (e) {
      const btn = e.target.closest(".ing-chip");
      if (!btn) return;
      const k = btn.dataset.k;
      if (state.picked.has(k)) state.picked.delete(k);
      else state.picked.add(k);
      btn.classList.toggle("on");
      renderPicked();
      save();
    });

    $("#pickedList").addEventListener("click", function (e) {
      const tag = e.target.closest(".picked-tag");
      if (!tag) return;
      // 点标签也能取消（用索引对应）
      const idx = Array.from($("#pickedList").children).indexOf(tag);
      const key = Array.from(state.picked)[idx];
      if (key) {
        state.picked.delete(key);
        renderPicked();
        renderIngredients();
        save();
      }
    });

    $("#clearPicked").onclick = function () {
      state.picked.clear();
      renderPicked();
      renderIngredients();
      save();
      toast("已清空");
    };

    $("#ingSearch").addEventListener("input", function () {
      state.keyword = this.value;
      renderIngredients();
    });

    $("#goCook").onclick = function () {
      state.filter = "ready";
      $$(".chip-tab").forEach((b) => b.classList.toggle("active", b.dataset.filter === "ready"));
      switchTab("cook");
    };

    $("#filterRow").addEventListener("click", function (e) {
      const b = e.target.closest(".chip-tab");
      if (!b) return;
      state.filter = b.dataset.filter;
      $$(".chip-tab").forEach((x) => x.classList.toggle("active", x === b));
      renderRecipes();
    });

    $("#recipeList").addEventListener("click", function (e) {
      const card = e.target.closest(".recipe-card");
      if (card) openDetail(card.dataset.id);
    });
    $("#favList").addEventListener("click", function (e) {
      const card = e.target.closest(".recipe-card");
      if (card) openDetail(card.dataset.id);
    });

    $(".tabbar").addEventListener("click", function (e) {
      const b = e.target.closest(".tab");
      if (!b) return;
      switchTab(b.dataset.tab);
    });

    $("#randomBtn").onclick = function () {
      const pool = state.picked.size ? listFor("ready") : [];
      const source = pool.length
        ? pool
        : RECIPES.map((r) => ({ r, m: matchOf(r) })).sort((a, b) => b.m.pct - a.m.pct);
      const pick = source[Math.floor(Math.random() * Math.min(source.length, 8))];
      if (!pick) return;
      toast("就它了：" + pick.r.n);
      setTimeout(() => openDetail(pick.r.id), 260);
    };

    // Android 物理返回键
    window.appOnBack = function () {
      if ($("#detailPage").classList.contains("open")) {
        closeDetail();
        return true;
      }
      if (state.tab !== "pick") {
        switchTab("pick");
        return true;
      }
      return false;
    };
  }

  /* ---------- 启动 ---------- */
  load();
  renderIngredients();
  renderPicked();
  bind();
})();
