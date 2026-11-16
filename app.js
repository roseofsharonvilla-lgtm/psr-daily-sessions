(function(){
const CATS = window.PSR_CATS || [];
const TOPICS = [];
CATS.forEach(c => c.items.forEach((it, i) => TOPICS.push(Object.assign({cat:c.name, catIndex:i+1}, it))));
TOPICS.forEach((t, i) => t.id = i);

const ORDER = (() => {
  const lists = CATS.map(c => TOPICS.filter(t => t.cat === c.name));
  const out = [];
  let i = 0, added = true;
  while (added) {
    added = false;
    lists.forEach(l => { if (l[i]) { out.push(l[i].id); added = true; } });
    i++;
  }
  return out;
})();
ORDER.forEach((id, n) => TOPICS[id].num = n + 1);

const SLOTS = {A:{name:"Afternoon Session", time:"1:00 PM", cls:""}, E:{name:"Evening Session", time:"6:00 PM", cls:"evening"}};
const ANCHOR = new Date(2026, 10, 16);
const DAY = 86400000;

const store = {
  get(k, d){ try { const v = localStorage.getItem("psr_" + k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem("psr_" + k, JSON.stringify(v)); } catch(e){} }
};

let roster = store.get("roster", []);
let swaps = store.get("swaps", {});
const DEFAULT_EMAIL = "rossvoffice@gmail.com, roseofsharonvilla@gmail.com";
let settings = store.get("settings", {email:DEFAULT_EMAIL});
if (!settings.email || settings.email === "roseofsharonvilla@gmail.com") settings.email = DEFAULT_EMAIL;
const SEND_URL = window.PSR_SEND_URL || "";
let view = "today";
let curDate = today();
let session = store.get("draft", null);
let libCat = "All";
let libQ = "";
let swapPicker = null;

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function today(){ const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function key(d){ return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function fromKey(k){ const p = k.split("-").map(Number); return new Date(p[0], p[1]-1, p[2]); }
function nice(d){ return d.toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric", year:"numeric"}); }
function dayIndex(d){ return Math.round((d - ANCHOR) / DAY); }
function mod(a, b){ return ((a % b) + b) % b; }
function scheduled(d, slot){ const n = dayIndex(d) * 2 + (slot === "E" ? 1 : 0); return ORDER[mod(n, ORDER.length)]; }
function topicFor(d, slot){ const k = key(d) + "_" + slot; return swaps[k] != null && TOPICS[swaps[k]] ? swaps[k] : scheduled(d, slot); }
function isSwapped(d, slot){ return swaps[key(d) + "_" + slot] != null; }

function questions(t){
  const qs = [];
  let n = 0;
  const add = (text, listen, sec) => qs.push({id:"q" + (++n), n, text, listen:listen || "", sec});
  t.warm.forEach(q => add(q, "", "warm"));
  t.terms.forEach(x => add(x[3], "", "terms"));
  t.sq.forEach(q => add(q, "", "story"));
  t.d.forEach(q => add(q, "", "act"));
  t.disc.forEach(x => add(x[0], x[1], "disc"));
  add("What is one thing you learned today about " + t.t.toLowerCase() + " that you want to remember?", "Any honest answer counts. Thank each person by name.", "wrap");
  add("What is one small step you could try this week?", "Help them make it small and real: one call, one habit, one conversation.", "wrap");
  return qs;
}

function render(){
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.view === (view === "session" ? "today" : view)));
  const app = $("#app");
  if (view === "today") app.innerHTML = viewToday();
  else if (view === "library") app.innerHTML = viewLibrary();
  else if (view === "residents") app.innerHTML = viewResidents();
  else if (view === "session") app.innerHTML = viewSession();
  document.body.style.paddingBottom = view === "session" ? "90px" : "";
  bindFloat();
}

function slotCard(slot){
  const id = topicFor(curDate, slot), t = TOPICS[id], s = SLOTS[slot];
  const qn = questions(t).length;
  const draftHere = session && session.date === key(curDate) && session.slot === slot;
  return `<div class="card slot ${s.cls}">
    <div class="row between"><div class="slot-label">${s.name} · ${s.time}</div>${isSwapped(curDate, slot) ? '<span class="swapped">Changed by staff</span>' : '<span class="muted small">Scheduled topic</span>'}</div>
    <h2>${esc(t.t)}</h2>
    <span class="cat">${esc(t.cat)}</span>
    <p>${esc(t.goal)}</p>
    <p class="muted small">60 minutes · ${qn} discussion questions · Topic #${t.num} of ${TOPICS.length}</p>
    <div class="row">
      <button class="btn" data-act="start" data-slot="${slot}">${draftHere ? "Continue Session" : "Start Session"}</button>
      <button class="btn ghost" data-act="swap" data-slot="${slot}">Change Topic</button>
      ${isSwapped(curDate, slot) ? `<button class="btn ghost sm" data-act="unswap" data-slot="${slot}">Use Scheduled Topic</button>` : ""}
      <button class="btn ghost sm" data-act="printguide" data-id="${id}">Print Guide</button>
    </div>
  </div>`;
}

function viewToday(){
  const isToday = key(curDate) === key(today());
  return `<div class="daybar">
      <button class="btn ghost sm" data-act="day" data-d="-1">‹ Previous Day</button>
      <div style="text-align:center"><h2>${isToday ? "Today" : nice(curDate).split(",")[0]}</h2><div class="muted">${nice(curDate)}</div></div>
      <button class="btn ghost sm" data-act="day" data-d="1">Next Day ›</button>
    </div>
    ${!isToday ? `<div style="text-align:center;margin:-6px 0 14px"><button class="btn sm gold" data-act="gotoday">Back to Today</button></div>` : ""}
    ${roster.length === 0 ? `<div class="card note"><b>First time here?</b> Add your residents once on the <a href="#" data-act="go" data-v="residents">Residents</a> page so you can check them in and mark who answered. Names stay on this device only.</div>` : ""}
    <div class="grid2">${slotCard("A")}${slotCard("E")}</div>
    <div class="card"><h3>How it works</h3>
      <ol class="steps">
        <li>Keep the topic the day gives you, or tap <b>Change Topic</b> to pick any of the ${TOPICS.length} topics.</li>
        <li>Tap <b>Start Session</b>, check in every resident who came, and read the guide out loud. Every word you need is written for you.</li>
        <li>When a resident answers a question, tap their name under that question.</li>
        <li>Tap <b>Submit</b>. The summary emails to the office automatically. Then print the sign-in sheet (or save it as a PDF) and have residents sign.</li>
      </ol>
    </div>`;
}

function libList(){
  const q = libQ.trim().toLowerCase();
  const list = ORDER.map(id => TOPICS[id]).filter(t => (libCat === "All" || t.cat === libCat) && (!q || (t.t + " " + t.goal + " " + t.cat + " " + t.terms.map(x => x[0]).join(" ")).toLowerCase().includes(q)));
  return list.map(t => `<div class="lib-item"><div><h3><span class="num">#${t.num}</span>${esc(t.t)}</h3><div class="small muted">${esc(t.cat)} · ${esc(t.goal)}</div></div>
    <div class="row" style="flex-wrap:nowrap">${swapPicker ? `<button class="btn sm" data-act="pick" data-id="${t.id}">Use This</button>` : `<button class="btn ghost sm" data-act="preview" data-id="${t.id}">View</button>`}</div></div>`).join("") || '<p class="muted">No topics match.</p>';
}

function libraryBody(){
  const counts = {};
  TOPICS.forEach(t => counts[t.cat] = (counts[t.cat] || 0) + 1);
  return `<input class="search" id="libSearch" placeholder="Search ${TOPICS.length} topics… (try credit, anger, laundry)" value="${esc(libQ)}">
    <div class="chips">${["All"].concat(CATS.map(c => c.name)).map(c => `<button class="chip ${libCat === c ? "on" : ""}" data-act="cat" data-c="${esc(c)}">${esc(c)} ${c === "All" ? TOPICS.length : counts[c]}</button>`).join("")}</div>
    <div id="libList">${libList()}</div>`;
}

function viewLibrary(){
  return `<div class="card"><h2>All ${TOPICS.length} PSR Topics</h2><p class="muted">Each topic is a full one-hour session with a word-for-word facilitator guide and ${questions(TOPICS[0]).length} questions.</p>${libraryBody()}</div>`;
}

function viewResidents(){
  return `<div class="card"><h2>Residents</h2>
    <p class="muted">Add each resident once. These names are saved only on this device, so check-in is one tap. Do this on each tablet or computer staff use.</p>
    <textarea class="search" id="newRes" rows="3" placeholder="Type one resident name, or paste a list with one name per line"></textarea>
    <div class="row" style="margin:8px 0 4px"><button class="btn" data-act="addres">Add Resident(s)</button></div>
    <div>${roster.slice().sort((a,b)=>a.localeCompare(b)).map(r => `<div class="res-row"><span>${esc(r)}</span><button class="btn danger sm" data-act="delres" data-n="${esc(r)}">Remove</button></div>`).join("") || '<p class="muted">No residents added yet.</p>'}</div>
  </div>
  <div class="card"><h3>Session summaries are emailed to</h3>
    ${SEND_URL ? `<p>When staff tap <b>Submit</b>, the summary and PDF email automatically to <b>${esc(DEFAULT_EMAIL)}</b>.</p>` : `<label class="field"><span>Email addresses (separate with commas)</span><input id="emailTo" value="${esc(settings.email)}"></label>
    <button class="btn sm" data-act="saveemail">Save</button>`}
  </div>`;
}

function guideHTML(t, interactive){
  const qs = questions(t);
  let qi = 0;
  const NUDGE = {warm:"Share your own simple answer first to get things going, then ask again.", terms:"Read the example again slowly, then ask: Has anything like that ever happened to you or someone you know?", story:"Read that part of the story again, then ask the question one more time.", act:"Point to what the group just did and ask: What did you notice?", disc:"Say: There's no wrong answer. Then call on someone gently by name: ___, what do you think?", wrap:"Give your own answer first, then go around the circle."};
  const qBlock = () => {
    const q = qs[qi++];
    const help = `<div class="listen"><b>After someone answers, say:</b> "Thank you, (name). Does anyone else want to add to that?" · <b>If no one answers:</b> ${esc(NUDGE[q.sec])}</div>`;
    if (!interactive) return `<div class="q"><div class="q-top"><span class="qn">Q${q.n}</span><div><div class="q-text">${esc(q.text)}</div>${q.listen ? `<div class="listen"><b>Listen for:</b> ${esc(q.listen)}</div>` : ""}${help}</div></div></div>`;
    const who = session.ans[q.id] || [];
    return `<div class="q ${who.length ? "answered" : ""}" id="${q.id}"><div class="q-top"><span class="qn">Q${q.n}</span><div style="flex:1"><div class="q-text">${esc(q.text)}</div>${q.listen ? `<div class="listen"><b>Listen for:</b> ${esc(q.listen)}</div>` : ""}${help}
      <div class="who">${session.present.length ? session.present.map(p => `<button class="${who.includes(p) ? "on" : ""}" data-act="ans" data-q="${q.id}" data-n="${esc(p)}">${who.includes(p) ? "✓ " : ""}${esc(p)}</button>`).join("") : '<span class="none">Check in residents above to mark who answered.</span>'}</div>
      <input class="qnote" data-q="${q.id}" value="${esc((session.qnotes || {})[q.id] || "")}" placeholder="Optional: jot down what residents said"></div></div></div>`;
  };
  const tl = t.t;
  const mats = t.act.m && !/^none/i.test(t.act.m) ? t.act.m : "";
  let h = "";
  h += `<div class="note"><b>Before you start (5 minutes before group):</b> Read this whole guide once. Set out chairs in a circle, have pens and paper ready${mats ? ", plus: " + esc(mats) : ""}. Read the bold parts out loud, word for word. You do not need to be an expert. Your job is to read, ask, listen, and thank people. It is always OK for a resident to pass. Do not give medical or legal advice; if a question comes up, say "That's a great question for the nurse (or the social worker). I'll help you ask them."</div>`;

  h += `<div class="sec"><h3>1. Welcome &amp; Sign-In<span class="time">4 min · clock 0:00–0:04</span></h3></div>
    <div class="say"><b>Say:</b> "Good ${"{{slot}}"}, everyone! Thank you for coming. My name is ____. Today's group is called <b>${esc(tl)}</b>. ${esc(t.goal)} This group lasts about one hour. There are no wrong answers here, and you can always pass if you don't want to answer."</div>
    <div class="say"><b>Say:</b> "Two group rules: one person talks at a time, and what people share in group stays in group. Can everyone agree to that?"</div>
    <div class="do"><b>Do:</b> Check in each resident who came. Wait for nods or a "yes" before you move on. Make sure the sign-in sheet will be printed at the end.</div>
    <div class="say"><b>Say:</b> "Before we start, let's go around the circle. Say your name and how you're feeling today in one word."</div>`;

  h += `<div class="sec"><h3>2. Warm-Up<span class="time">6 min · clock 0:04–0:10</span></h3></div>
    <div class="say"><b>Say:</b> "Let's warm up. I'm going to ask a few easy questions. Just say whatever comes to mind."</div>`;
  t.warm.forEach(() => h += qBlock());

  h += `<div class="sec"><h3>3. Learn the Words<span class="time">15 min · clock 0:10–0:25</span></h3></div>
    <div class="say"><b>Say:</b> "Now we're going to learn ${t.terms.length} important words about ${esc(tl.toLowerCase())}. I'll say the word, tell you what it means, give an example, and then ask you a question about it."</div>
    <div class="do"><b>Do:</b> For each word: read the word, read what it means, read the example, then ask the question. Write each word on paper or a board if you have one.</div>`;
  t.terms.forEach((x, i) => {
    h += `<div class="term"><h4>Word ${i+1}: ${esc(x[0])}</h4><div><b>Say:</b> "${esc(x[0])} means ${esc(x[1])}"</div><div class="ex"><b>Example to read:</b> "${esc(x[2])}"</div></div>`;
    h += qBlock();
  });

  h += `<div class="sec"><h3>4. Real-Life Story<span class="time">10 min · clock 0:25–0:35</span></h3></div>
    <div class="say"><b>Say:</b> "I'm going to read a short story. Listen closely, because I'll ask you some questions about it afterward."</div>
    <div class="story">${esc(t.story)}</div>
    <div class="do"><b>Do:</b> Read the story slowly, out loud. Then say: "Let me read it one more time," and read it again. Then ask these questions:</div>`;
  t.sq.forEach(() => h += qBlock());

  h += `<div class="sec"><h3>5. Group Activity: ${esc(t.act.n)}<span class="time">14 min · clock 0:35–0:49</span></h3></div>
    ${mats ? `<div class="do"><b>You will need:</b> ${esc(mats)}</div>` : ""}
    <div class="say"><b>Say:</b> "Now we're going to do an activity together called ${esc(t.act.n)}. Everyone can join in, and you can help each other."</div>
    <div class="do"><b>Do these steps in order:</b></div>
    <ol class="steps">${t.act.s.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    <div class="do"><b>Tip:</b> Go slowly and let as many people take a turn as possible. If the group finishes early, do the activity a second time with new examples from the residents.</div>
    <div class="say"><b>Say after the activity:</b> "Great work, everyone. Let's talk about what we just did."</div>`;
  t.d.forEach(() => h += qBlock());

  h += `<div class="sec"><h3>6. Group Discussion<span class="time">8 min · clock 0:49–0:57</span></h3></div>
    <div class="say"><b>Say:</b> "Let's go a little deeper. Anyone can answer. If you haven't talked yet today, I'd love to hear from you."</div>`;
  t.disc.forEach(() => h += qBlock());

  h += `<div class="sec"><h3>7. Wrap-Up<span class="time">3 min · clock 0:57–1:00</span></h3></div>
    <div class="say"><b>Say:</b> "Here's the main thing to remember today: ${esc(t.take)}"</div>`;
  h += qBlock(); h += qBlock();
  h += `<div class="say"><b>Say:</b> "Here's something to try before our next group: ${esc(t.tryit)} Thank you all for coming and for sharing. Please make sure you signed the sign-in sheet."</div>
    <div class="do"><b>If you finish early:</b> Go back to any question that only one or two people answered and ask, "Does anyone else want to add to that?" Or ask residents to share a time they used something from today's words.</div>`;
  return h;
}

function viewSession(){
  const t = TOPICS[session.topicId], s = SLOTS[session.slot];
  const qs = questions(t);
  const answered = qs.filter(q => (session.ans[q.id] || []).length).length;
  const slotWord = session.slot === "E" ? "evening" : "afternoon";
  return `<div class="session-head"><div class="row between"><div><div class="slot-label" style="color:var(--gold)">${s.name} · ${nice(fromKey(session.date))}</div><h2>${esc(t.t)}</h2><span class="cat">${esc(t.cat)}</span></div>
      <button class="btn ghost sm" data-act="leave">‹ Back</button></div></div>
    <div class="card">
      <div class="grid2">
        <label class="field"><span>Facilitator (your name)</span><input id="fac" value="${esc(session.fac)}" placeholder="Caregiver name"></label>
        </div>
      <div class="grid2">
        <label class="field"><span>Start time</span><div class="row" style="flex-wrap:nowrap"><input id="stime" value="${esc(session.start)}" placeholder="1:00 PM"><button class="btn ghost sm" data-act="now" data-f="start">Now</button></div></label>
        <label class="field"><span>End time</span><div class="row" style="flex-wrap:nowrap"><input id="etime" value="${esc(session.end || "")}" placeholder="2:00 PM"><button class="btn ghost sm" data-act="now" data-f="end">Now</button></div></label>
      </div>
      <div class="row between"><h3>Who is here? <span class="muted small">(${session.present.length} checked in)</span></h3>
        <div class="row"><button class="btn ghost sm" data-act="all">Select All</button><button class="btn ghost sm" data-act="nonein">Clear</button></div></div>
      <div class="attend-list">${allNames().map(n => `<label class="attend ${session.present.includes(n) ? "on" : ""}"><input type="checkbox" data-act="present" data-n="${esc(n)}" ${session.present.includes(n) ? "checked" : ""}>${esc(n)}</label>`).join("") || '<p class="muted">No residents yet. Add a name below, or add your full list on the Residents page.</p>'}</div>
      <div class="row" style="margin-top:10px"><input class="search" style="flex:1" id="addGuest" placeholder="Add a resident not on the list"><button class="btn sm" data-act="addguest">Add</button></div>
    </div>
    <div class="card"><div class="row between"><h3>Who Answered — At a Glance</h3><span class="muted small">${answered} of ${qs.length} questions answered · tap a box to mark</span></div>
      ${gridHTML(qs)}
    </div>
    <div class="card guide">${guideHTML(t, true).replace("{{slot}}", slotWord)}</div>
    <div class="card"><label class="field"><span>Notes (optional)</span><textarea id="notes" rows="3" placeholder="Anything to report? Who left early, who needs follow-up, etc.">${esc(session.notes)}</textarea></label></div>`;
}

function gridHTML(qs){
  if (!session.present.length) return '<p class="muted">Check in residents to see the grid.</p>';
  return `<div class="grid-wrap"><table class="pgrid"><thead><tr><th>Resident</th>${qs.map(q => `<th title="${esc(q.text)}">Q${q.n}</th>`).join("")}<th>Total</th></tr></thead><tbody>
    ${session.present.map(p => { let c = 0; return `<tr><td>${esc(p)}</td>${qs.map(q => { const on = (session.ans[q.id] || []).includes(p); if (on) c++; return `<td class="cell ${on ? "hit" : ""}" data-act="ans" data-q="${q.id}" data-n="${esc(p)}">${on ? "✓" : ""}</td>`; }).join("")}<td><b>${c}</b></td></tr>`; }).join("")}
  </tbody></table></div>`;
}

function allNames(){
  const s = new Set(roster);
  (session ? session.present.concat(session.guests || []) : []).forEach(n => s.add(n));
  return Array.from(s).sort((a,b)=>a.localeCompare(b));
}

function bindFloat(){
  let fb = $("#floatbar");
  if (view !== "session") { if (fb) fb.remove(); return; }
  if (!fb) { fb = document.createElement("div"); fb.id = "floatbar"; fb.className = "floatbar"; document.body.appendChild(fb); }
  fb.innerHTML = `<div class="inner"><span class="small"><b>${session.present.length}</b> here · <b>${Object.values(session.ans).filter(a => a.length).length}</b> questions answered</span>
    <div class="row"><button class="btn ghost sm" data-act="cancel">Discard</button><button class="btn gold" data-act="finish">Submit</button></div></div>`;
}

function saveDraft(){ store.set("draft", session); }

function startSession(slot){
  const d = key(curDate);
  if (!(session && session.date === d && session.slot === slot)) {
    if (session && !confirm("You have another session in progress. Start this new one instead? The other one will be cleared.")) return;
    session = {date:d, slot, topicId:topicFor(curDate, slot), fac:"", start:"", end:"", present:[], guests:[], ans:{}, notes:""};
    saveDraft();
  }
  view = "session"; render(); scrollTo(0,0);
}

function openModal(html){ $("#modalCard").innerHTML = html; $("#modal").classList.remove("hidden"); }
function closeModal(){ $("#modal").classList.add("hidden"); swapPicker = null; }

function openSwap(slot){
  swapPicker = slot; libQ = ""; libCat = "All";
  openModal(`<div class="row between"><h2>Change ${SLOTS[slot].name}</h2><button class="btn ghost sm" data-act="close">Close</button></div>
    <p class="muted">Pick any topic for ${nice(curDate)}. Only this session changes.</p>${libraryBody()}`);
}

function preview(id){
  const t = TOPICS[id];
  openModal(`<div class="row between"><div><span class="num">#${t.num}</span><span class="cat">${esc(t.cat)}</span><h2 style="margin-top:6px">${esc(t.t)}</h2></div>
    <div class="row"><button class="btn sm" data-act="printguide" data-id="${id}">Print Guide</button><button class="btn ghost sm" data-act="close">Close</button></div></div>
    <p>${esc(t.goal)}</p><div class="guide">${guideHTML(t, false).replace("{{slot}}", "afternoon")}</div>`);
}

function doPrint(html){
  $("#print").innerHTML = html;
  document.body.classList.add("printing");
  setTimeout(() => { window.print(); }, 150);
}
window.addEventListener("afterprint", () => document.body.classList.remove("printing"));

function printGuide(id){
  const t = TOPICS[id];
  doPrint(`<div class="p-head"><div class="eyebrow">Rose of Sharon Senior Villa · PSR Facilitator Guide</div><h1>${esc(t.t)}</h1><div>${esc(t.cat)} · Topic #${t.num} · 60 minutes</div></div>
    <p>${esc(t.goal)}</p><div class="p-guide">${guideHTML(t, false).replace("{{slot}}", "afternoon")}</div>`);
}

function reportHTML(){
  const t = TOPICS[session.topicId], s = SLOTS[session.slot], qs = questions(t);
  const cnt = p => qs.filter(q => (session.ans[q.id] || []).includes(p)).length;
  const rows = session.present.map((p, i) => `<tr><td>${i+1}</td><td>${esc(p)}</td><td class="sig"></td><td style="text-align:center">${cnt(p)}</td></tr>`).join("");
  const blanks = Array.from({length:Math.max(0, 3)}, (_, i) => `<tr><td>${session.present.length + i + 1}</td><td></td><td class="sig"></td><td></td></tr>`).join("");
  return `<div class="p-head"><div class="eyebrow">Rose of Sharon Senior Villa · PSR Group Attendance</div><h1>${esc(t.t)}</h1></div>
    <div class="p-meta"><div><b>Date:</b> ${nice(fromKey(session.date))}</div><div><b>Session:</b> ${s.name}</div>
      <div><b>Topic area:</b> ${esc(t.cat)}</div><div><b>Facilitator:</b> ${esc(session.fac) || "________________"}</div>
      <div><b>Start time:</b> ${esc(session.start) || "________"}</div><div><b>End time:</b> ${esc(session.end) || "________"}</div>
      <div><b>Residents present:</b> ${session.present.length}</div><div><b>Questions answered:</b> ${qs.filter(q => (session.ans[q.id] || []).length).length} of ${qs.length}</div></div>
    <div class="p-h2">Resident Sign-In</div>
    <p style="font-size:10pt;margin:0">By signing, I confirm I attended this PSR group.</p>
    <table class="p-table"><thead><tr><th style="width:5%">#</th><th style="width:33%">Resident Name</th><th>Resident Signature</th><th style="width:14%">Questions Answered</th></tr></thead><tbody>${rows}${blanks}</tbody></table>
    ${session.notes ? `<div class="p-h2">Notes</div><p>${esc(session.notes)}</p>` : ""}
    <div class="p-sign"><div>Facilitator Signature</div><div>Date</div></div>
    <div class="pb"></div>
    <div class="p-head"><div class="eyebrow">Rose of Sharon Senior Villa · PSR Session Record</div><h1 style="font-size:18pt">${esc(t.t)} · ${nice(fromKey(session.date))}</h1></div>
    <div class="p-meta"><div><b>Session:</b> ${s.name}</div><div><b>Time:</b> ${esc(session.start) || "____"} to ${esc(session.end) || "____"}</div><div><b>Facilitator:</b> ${esc(session.fac)}</div><div><b>Topic area:</b> ${esc(t.cat)}</div></div>
    <p><b>Session goal:</b> ${esc(t.goal)}</p>
    <p><b>Key words taught:</b> ${t.terms.map(x => esc(x[0])).join(", ")}</p>
    <p><b>Group activity:</b> ${esc(t.act.n)}</p>
    <p><b>Main takeaway:</b> ${esc(t.take)}</p>
    <div class="p-h2">Resident Participation Summary</div>
    <table class="p-table"><thead><tr><th style="width:28%">Resident</th><th style="width:16%">Questions Answered</th><th>Which Questions</th></tr></thead><tbody>
    ${session.present.map(p => { const mine = qs.filter(q => (session.ans[q.id] || []).includes(p)); return `<tr><td>${esc(p)}</td><td style="text-align:center">${mine.length} of ${qs.length}</td><td>${mine.map(q => "Q" + q.n).join(", ") || "<i>Attended, did not answer</i>"}</td></tr>`; }).join("")}
    </tbody></table>
    <div class="pb"></div>
    <div class="p-head"><div class="eyebrow">All Questions Asked</div><h1 style="font-size:18pt">${esc(t.t)} · ${nice(fromKey(session.date))}</h1></div>
    <table class="p-table"><thead><tr><th style="width:6%">Q#</th><th style="width:36%">Question Asked</th><th style="width:6%">#</th><th style="width:24%">Who Answered</th><th>What Was Said</th></tr></thead><tbody>
    ${qs.map(q => { const w = session.ans[q.id] || []; return `<tr><td>Q${q.n}</td><td>${esc(q.text)}</td><td style="text-align:center">${w.length}</td><td>${esc(w.join(", ")) || "<i>No answer</i>"}</td><td>${esc((session.qnotes || {})[q.id] || "")}</td></tr>`; }).join("")}</tbody></table>
    <div class="p-sign"><div>Facilitator Signature</div><div>Date</div></div>`;
}

function emailBody(){
  const t = TOPICS[session.topicId], qs = questions(t);
  let b = `PSR Session Summary\n\nTopic: ${t.t} (${t.cat})\nDate: ${nice(fromKey(session.date))}\nSession: ${SLOTS[session.slot].name}\nStart time: ${session.start}\nEnd time: ${session.end || ""}\nFacilitator: ${session.fac}\n\nResidents present (${session.present.length}):\n`;
  b += session.present.join(", ");
  b += `\n\nKey words taught: ${t.terms.map(x => x[0]).join(", ")}\nActivity: ${t.act.n}\n\nResident participation:\n` + session.present.map(p => { const m = qs.filter(q => (session.ans[q.id] || []).includes(p)); return `- ${p}: ${m.length} of ${qs.length} (${m.map(q => "Q" + q.n).join(", ") || "none"})`; }).join("\n");
  b += `\n\nAll questions asked and who answered:\n`;
  b += qs.map(q => `Q${q.n}. ${q.text}\n   Answered by: ${(session.ans[q.id] || []).join(", ") || "none"}` + ((session.qnotes || {})[q.id] ? `\n   What was said: ${session.qnotes[q.id]}` : "")).join("\n");
  if (session.notes) b += `\n\nNotes: ${session.notes}`;
  b += `\n\nThe signed sign-in sheet is on file.`;
  return b;
}

function finish(){
  if (!session.end) { session.end = new Date().toLocaleTimeString("en-US", {hour:"numeric", minute:"2-digit"}); saveDraft(); }
  if (!session.present.length && !confirm("No residents are checked in. Submit anyway?")) return;
  if (!session.fac) { const f = prompt("Facilitator name for the sign-in sheet:"); if (f) { session.fac = f; saveDraft(); } }
  const t = TOPICS[session.topicId];
  openModal(`<h2>Submit Session</h2><p><b>${esc(t.t)}</b> · ${session.present.length} residents · ${questions(t).filter(q => (session.ans[q.id] || []).length).length} questions answered</p>
    <div id="sendStatus" class="note">${SEND_URL ? "Sending to " + esc(DEFAULT_EMAIL) + "…" : "Tap Email Summary to send it to " + esc(settings.email) + "."}</div>
    <ol class="steps"><li><b>Print the sign-in sheet</b> and have each resident sign. In the print window you can also choose <b>Save as PDF</b>.</li><li>Tap <b>Done</b> to clear the session.</li></ol>
    <div class="row"><button class="btn" data-act="printreport">Print / Save PDF</button><button class="btn ghost" data-act="email">${SEND_URL ? "Email Again" : "Email Summary"}</button><button class="btn gold" data-act="done">Done</button><button class="btn ghost sm" data-act="close">Keep Editing</button></div>`);
  if (SEND_URL) autoSend();
}

function autoSend(){
  const t = TOPICS[session.topicId];
  const payload = {to:settings.email, subject:`PSR Summary: ${t.t} - ${SLOTS[session.slot].name} - ${nice(fromKey(session.date))}`, text:emailBody(), html:reportHTML(), facilitator:session.fac, start:session.start, end:session.end, topic:t.t, date:session.date, slot:SLOTS[session.slot].name, present:session.present.length};
  const st = $("#sendStatus");
  fetch(SEND_URL, {method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify(payload)})
    .then(() => { session.sent = true; saveDraft(); if (st) st.innerHTML = "✓ Sent to " + esc(DEFAULT_EMAIL) + " with a PDF copy attached."; })
    .catch(() => { if (st) st.innerHTML = "Could not send automatically (no internet?). Tap <b>Email Again</b> to try, or print the sheet."; });
}

function emailSummary(){
  const t = TOPICS[session.topicId];
  const subj = `PSR Summary: ${t.t} - ${SLOTS[session.slot].name} - ${session.date}`;
  let body = emailBody();
  if (body.length > 1800) body = body.slice(0, 1800) + "\n…(see printed sheet for the full list)";
  location.href = `mailto:${settings.email.split(",").map(x => encodeURIComponent(x.trim())).join(",")}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
}

function toggleAns(qid, name){
  const a = session.ans[qid] || (session.ans[qid] = []);
  const i = a.indexOf(name);
  if (i >= 0) a.splice(i, 1); else a.push(name);
  saveDraft();
  const y = scrollY; render(); scrollTo(0, y);
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (e.target.id === "modal") { closeModal(); return; }
  if (!el) return;
  const a = el.dataset.act;
  if (a === "present") return;
  if (el.tagName === "A") e.preventDefault();
  if (a === "go") { view = el.dataset.v; render(); }
  else if (a === "day") { curDate = new Date(curDate.getTime() + Number(el.dataset.d) * DAY + 3600000); curDate = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate()); render(); }
  else if (a === "gotoday") { curDate = today(); render(); }
  else if (a === "start") startSession(el.dataset.slot);
  else if (a === "swap") openSwap(el.dataset.slot);
  else if (a === "unswap") { delete swaps[key(curDate) + "_" + el.dataset.slot]; store.set("swaps", swaps); render(); }
  else if (a === "pick") { swaps[key(curDate) + "_" + swapPicker] = Number(el.dataset.id); store.set("swaps", swaps); if (session && session.date === key(curDate) && session.slot === swapPicker) { session.topicId = Number(el.dataset.id); session.ans = {}; saveDraft(); } closeModal(); render(); }
  else if (a === "cat") { libCat = el.dataset.c; const box = el.closest(".modal-card") || $("#app"); box.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.dataset.c === libCat)); box.querySelector("#libList").innerHTML = libList(); }
  else if (a === "preview") preview(Number(el.dataset.id));
  else if (a === "printguide") printGuide(Number(el.dataset.id));
  else if (a === "close") closeModal();
  else if (a === "addres") { const v = $("#newRes").value; v.split(/\n|,/).map(s => s.trim()).filter(Boolean).forEach(n => { if (!roster.includes(n)) roster.push(n); }); store.set("roster", roster); render(); }
  else if (a === "delres") { if (confirm("Remove " + el.dataset.n + " from this device's list?")) { roster = roster.filter(r => r !== el.dataset.n); store.set("roster", roster); render(); } }
  else if (a === "saveemail") { settings.email = $("#emailTo").value.trim(); store.set("settings", settings); el.textContent = "Saved ✓"; }
  else if (a === "leave") { view = "today"; render(); }
  else if (a === "all") { session.present = allNames(); saveDraft(); render(); }
  else if (a === "nonein") { session.present = []; saveDraft(); render(); }
  else if (a === "addguest") { const n = $("#addGuest").value.trim(); if (n) { session.guests = session.guests || []; if (!session.guests.includes(n)) session.guests.push(n); if (!session.present.includes(n)) session.present.push(n); if (!roster.includes(n) && confirm("Also save " + n + " to the resident list on this device?")) { roster.push(n); store.set("roster", roster); } saveDraft(); render(); } }
  else if (a === "ans") toggleAns(el.dataset.q, el.dataset.n);
  else if (a === "finish") finish();
  else if (a === "now") { session[el.dataset.f] = new Date().toLocaleTimeString("en-US", {hour:"numeric", minute:"2-digit"}); saveDraft(); const y = scrollY; render(); scrollTo(0, y); }
  else if (a === "printreport") doPrint(reportHTML());
  else if (a === "email") { if (SEND_URL) autoSend(); else emailSummary(); }
  else if (a === "done") { if (session.sent || confirm("Clear this session? Make sure you printed or emailed it first.")) { session = null; store.set("draft", null); closeModal(); view = "today"; render(); } }
  else if (a === "cancel") { if (confirm("Discard this session? Nothing will be saved.")) { session = null; store.set("draft", null); view = "today"; render(); } }
});

document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset && el.dataset.act === "present") {
    const n = el.dataset.n;
    if (el.checked) { if (!session.present.includes(n)) session.present.push(n); }
    else { session.present = session.present.filter(p => p !== n); Object.values(session.ans).forEach(a => { const i = a.indexOf(n); if (i >= 0) a.splice(i, 1); }); }
    session.present.sort((a,b)=>a.localeCompare(b));
    saveDraft(); const y = scrollY; render(); scrollTo(0, y);
  }
});

document.addEventListener("input", e => {
  const id = e.target.id;
  if (id === "libSearch") { libQ = e.target.value; const box = e.target.closest(".modal-card") || $("#app"); box.querySelector("#libList").innerHTML = libList(); }
  else if (session && id === "fac") { session.fac = e.target.value; saveDraft(); }
  else if (session && id === "stime") { session.start = e.target.value; saveDraft(); }
  else if (session && id === "etime") { session.end = e.target.value; saveDraft(); }
  else if (session && id === "notes") { session.notes = e.target.value; saveDraft(); }
  else if (session && e.target.classList.contains("qnote")) { session.qnotes = session.qnotes || {}; session.qnotes[e.target.dataset.q] = e.target.value; saveDraft(); }
});

document.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.id === "addGuest") document.querySelector('[data-act="addguest"]').click();
  if (e.key === "Escape") closeModal();
});

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => { view = b.dataset.view; closeModal(); libQ = ""; libCat = "All"; render(); scrollTo(0,0); }));

render();
})();
