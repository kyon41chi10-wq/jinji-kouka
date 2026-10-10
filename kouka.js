/* 京町亭 人事考課 共通処理 */
var KOUKA = (function () {
  "use strict";
  var SUPABASE_URL = "https://drulwfyxfampqdkwboed.supabase.co";
  var SUPABASE_KEY = "sb_publishable_1fr-lXoK0pTamq3brnZrKw_RaxMjP6V";

  var SCALE = [
    { v: 5, short: "大幅に\n上回る", long: "上位者としても申し分ない。大幅に基準を上回った。" },
    { v: 4, short: "上回る", long: "余裕を持って基準を上回った。" },
    { v: 3, short: "基準通り", long: "基準通りの成果や取り組み姿勢であった。（職務遂行能力については、基準水準である）" },
    { v: 2, short: "下回る", long: "十分とは言えず、基準を下回った。" },
    { v: 1, short: "大幅に\n下回る", long: "基準を大幅に下回り、支障があった。" }
  ];
  var CIRCLED = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }

  function rpc(name, args) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : null;
    return fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args || {}),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) { var e = new Error((body && body.message) || ("HTTP " + r.status)); e.server = true; throw e; }
        return body;
      });
    }, function (err) {
      if (timer) clearTimeout(timer);
      var e = new Error("通信できませんでした。電波の良い場所でもう一度お試しください。");
      e.network = true; e.cause = err; throw e;
    });
  }

  function qLabel(n) { return "質問" + (CIRCLED[n] || n); }

  /* 合計点：回答済みの項目だけ合計 */
  function total(scores, items) {
    var sum = 0, n = 0;
    (items || []).forEach(function (it) {
      var v = scores && scores[String(it.no)];
      if (v >= 1 && v <= 5) { sum += Number(v); n++; }
    });
    return { sum: sum, n: n, max: (items || []).length * 5, complete: n === (items || []).length && n > 0 };
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtMD(iso) {
    if (!iso) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? (Number(m[2]) + "月" + Number(m[3]) + "日") : "";
  }
  function fmtYMD(iso) {
    if (!iso) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? (m[1] + "/" + Number(m[2]) + "/" + Number(m[3])) : "";
  }
  function fmtDateTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d)) return "";
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function yearsText(y) {
    y = String(y || "").trim();
    if (!y) return "";
    return /^[0-9０-９.．]+$/.test(y) ? y + " 年" : y;
  }

  /* 項目をカテゴリーごとにまとめる */
  function groupItems(items) {
    var groups = [];
    (items || []).forEach(function (it) {
      var last = groups[groups.length - 1];
      if (!last || last.cat !== (it.cat || "")) groups.push(last = { cat: it.cat || "", items: [] });
      last.items.push(it);
    });
    return groups;
  }

  /* ===== 印刷用（紙の考課表と同じ並び） ===== */
  function circle(v, chosen) {
    return '<td class="pv' + (Number(chosen) === v ? " on" : "") + '"><span>' + v + "</span></td>";
  }
  function sheetTitle(period) { return esc(period.title) + "　京町亭　人事考課表"; }

  function renderPrint(o) {
    var p = o.period, ev = o.ev || {}, items = p.items || [], qs = p.questions || [];
    var self = ev.self_scores || {}, first = ev.first_scores || {};
    var tSelf = total(self, items), tFirst = total(first, items);
    var html = '<section class="sheet">';
    html += '<div class="ph"><h1>' + sheetTitle(p) + '</h1><span>1/2</span></div>';
    html += '<table class="phead"><tbody>' +
      '<tr><th class="role">本人</th><th>記入日</th><td class="date">' + (fmtMD(ev.self_date) || "　　月　　日") + '</td><th>氏名</th><td class="name">' + esc(o.staffName) + '</td><th class="seal">印</th>' +
      '<th>勤続年数</th><td class="yrs" colspan="2">' + (esc(yearsText(ev.years)) || "　　　年") + '</td></tr>' +
      '<tr><th class="role">第１次</th><th>記入日</th><td class="date">' + (fmtMD(ev.first_date) || "　　月　　日") + '</td><th>氏名</th><td class="name">' + esc(ev.first_name || "") + '</td><th class="seal">印</th>' +
      '<th>管理者 氏名</th><td class="name">' + esc(ev.manager_name || "") + '</td><th class="seal">印</th></tr>' +
      '</tbody></table>';

    html += '<table class="pitems"><thead><tr><th class="c-cat" rowspan="2">評価要素</th><th class="c-no" rowspan="2">№</th><th class="c-text" rowspan="2">評価の着眼点</th><th class="c-who" rowspan="2">評価者</th><th colspan="5">評価段階</th></tr>' +
      '<tr><th class="pvh">5</th><th class="pvh">4</th><th class="pvh">3</th><th class="pvh">2</th><th class="pvh">1</th></tr></thead><tbody>';
    groupItems(items).forEach(function (g) {
      g.items.forEach(function (it, i) {
        var qt = it.q ? '<span class="qtag">' + qLabel(it.q) + "</span>" : "";
        var sub = it.sub ? '<div class="sub">' + nl2br(it.sub) + (qt ? "　" + qt : "") + "</div>" : (qt ? '<div class="sub">' + qt + "</div>" : "");
        var q = "";
        html += "<tr class=\"r1\">" +
          (i === 0 ? '<td class="c-cat" rowspan="' + g.items.length * 2 + '">' + nl2br(g.cat) + "</td>" : "") +
          '<td class="c-no" rowspan="2">' + it.no + '</td><td class="c-text" rowspan="2"><div>' + nl2br(it.text) + "</div>" + sub + q + "</td>" +
          '<td class="c-who">本人</td>' + [5, 4, 3, 2, 1].map(function (v) { return circle(v, self[it.no]); }).join("") + "</tr>" +
          '<tr class="r2"><td class="c-who">第１次</td>' + [5, 4, 3, 2, 1].map(function (v) { return circle(v, first[it.no]); }).join("") + "</tr>";
      });
    });
    html += "</tbody></table></section>";

    html += '<section class="sheet">';
    html += '<div class="ph"><h1>' + sheetTitle(p) + '</h1><span>2/2</span></div>';
    qs.forEach(function (q) {
      var ans = (ev.answers || {})[String(q.no)] || "";
      html += '<div class="pq"><div class="pq-t">' + qLabel(q.no) + "：" + esc(q.text) + '</div><div class="pq-a">' + nl2br(ans) + "</div></div>";
    });
    html += '<table class="ptot"><tbody>' +
      '<tr><th class="tl">本人計</th><td class="tv">' + (tSelf.n ? tSelf.sum : "") + '</td><th class="cl">自己評価<br>コメント</th><td class="cv">' +
        (p.comment_heading ? '<div class="hd">' + esc(p.comment_heading) + "</div>" : "") + nl2br(ev.self_comment || "") + "</td></tr>" +
      '<tr><th class="tl">第１次計</th><td class="tv">' + (tFirst.n ? tFirst.sum : "") + '</td><th class="cl">１次評価者<br>コメント</th><td class="cv">' + nl2br(ev.first_comment || "") + "</td></tr>" +
      '<tr><td class="blank" colspan="2"></td><th class="cl">管理者<br>コメント</th><td class="cv">' + nl2br(ev.manager_comment || "") + "</td></tr>" +
      "</tbody></table>";
    html += '<table class="plegend"><tbody>' +
      '<tr><th rowspan="3">５段階評価</th><td class="n">1</td><td>' + SCALE[4].long + '</td><td class="n">4</td><td>' + SCALE[1].long + "</td></tr>" +
      '<tr><td class="n">2</td><td>' + SCALE[3].long + '</td><td class="n">5</td><td>' + SCALE[0].long + "</td></tr>" +
      '<tr><td class="n">3</td><td colspan="3">' + SCALE[2].long + "</td></tr>" +
      "</tbody></table>";
    html += "</section>";
    return html;
  }

  function printSheets(list) {
    var box = $("printArea");
    if (!box) { box = document.createElement("div"); box.id = "printArea"; document.body.appendChild(box); }
    box.innerHTML = list.map(renderPrint).join("");
    document.body.classList.add("printing");
    setTimeout(function () {
      window.print();
      setTimeout(function () { document.body.classList.remove("printing"); }, 300);
    }, 60);
  }

  return {
    SCALE: SCALE, CIRCLED: CIRCLED, $: $, esc: esc, nl2br: nl2br, store: store, load: load, rpc: rpc,
    qLabel: qLabel, total: total, todayISO: todayISO, fmtMD: fmtMD, fmtYMD: fmtYMD, fmtDateTime: fmtDateTime,
    yearsText: yearsText, groupItems: groupItems, renderPrint: renderPrint, printSheets: printSheets
  };
})();
