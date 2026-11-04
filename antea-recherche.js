/* Antéa : branchement du site sur le moteur de recherche local (serve.py).
   Ajouté à la fin du site sans en modifier le code d'origine. */
(function () {
  const css = `
  .ar-grid{display:grid;grid-template-columns:260px 1fr;gap:18px;align-items:start}
  .ar-visuel img{width:100%;border-radius:10px;border:1px solid var(--line);display:block}
  .ar-steps{display:grid;gap:10px;margin-top:4px}
  .ar-step{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:#fffdf8}
  .ar-step .ic{width:22px;height:22px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:12px;border:2px solid var(--line);color:#fff}
  .ar-step.en_cours .ic{border-color:var(--gold);border-top-color:transparent;animation:arspin 0.9s linear infinite}
  .ar-step.fait .ic{background:var(--g);border-color:var(--g)}
  .ar-step.erreur .ic{background:#a84b3f;border-color:#a84b3f}
  .ar-step b{color:var(--gd);font-size:13px}.ar-step .d{font-size:11.5px;color:var(--muted);margin-top:2px}
  @keyframes arspin{to{transform:rotate(360deg)}}
  .ar-badge{display:inline-block;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap}
  .ar-badge.eleve{background:#7b1e2b;color:#fff}.ar-badge.moyen{background:#f0c35a;color:#3b2a00}.ar-badge.faible{background:#bcd0bb;color:#1f3a2a}
  .ar-glob{display:flex;gap:16px;align-items:flex-start;border-left:4px solid #7b1e2b;background:#f7f1e4;border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:16px}
  .ar-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
  .ar-card{border:1px solid var(--line);border-radius:12px;background:#fffdf8;padding:14px;display:flex;flex-direction:column;gap:10px}
  .ar-card .ar-top{display:flex;gap:12px;align-items:flex-start}.ar-card .hd{display:flex;justify-content:space-between;gap:8px;align-items:center}
  .ar-card img{width:104px;height:104px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;flex:none}
  .ar-card .meta{font-size:12px;line-height:1.6;flex:1;min-width:0;overflow-wrap:anywhere}.ar-card .meta b{color:var(--gd)}
  .ar-card .an{font-size:12px;color:#4e5a52;line-height:1.6}
  .ar-card a{color:var(--g);font-size:11.5px}
  .ar-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
  @media(max-width:900px){.ar-grid{grid-template-columns:1fr}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // --- page « Résultats de recherche » et entrée de menu
  const page = document.createElement('section');
  page.className = 'page hidden'; page.id = 'page-resultats';
  page.innerHTML = `<div class="head"><div><div class="eyebrow">Recherche d’antériorités</div><h1 id="ar-titre">Résultats de recherche</h1>
    <div class="sub" id="ar-sub">Lancez une recherche depuis « Nouvelle recherche ».</div></div></div>
    <div class="ar-grid"><div class="panel ar-visuel"><img id="ar-img" alt="Visuel étudié"><div class="tiny" id="ar-desc" style="margin-top:10px"></div></div>
    <div><div class="panel" id="ar-progress"><div class="panelhead"><div><h2>Recherche en cours</h2><div class="subhead" id="ar-chrono"></div></div></div><div class="ar-steps" id="ar-steps"></div></div>
    <div class="panel hidden" id="ar-results"></div></div></div>`;
  const ref = document.getElementById('page-reports');
  ref.parentNode.insertBefore(page, ref);
  const navNew = document.querySelector('[data-page="newsearch"]');
  const navRes = document.createElement('button');
  navRes.dataset.page = 'resultats'; navRes.innerHTML = '<span>◎</span>Résultats de recherche';
  navNew.after(navRes);

  const goOrig = window.go;
  window.go = function (p) {
    if (p !== 'resultats') { const r = goOrig(p); if (p === 'reports') refreshReportDossiers(); return r; }
    $$('.page').forEach(x => x.classList.add('hidden'));
    $('#page-resultats').classList.remove('hidden');
    $$('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === p));
    $('#crumb').textContent = 'Résultats de recherche';
    $('#side').classList.remove('open');
  };
  navRes.onclick = () => go('resultats');

  // --- libellés du formulaire : le visuel part désormais au moteur local
  const up = document.querySelector('#page-newsearch .upload');
  if (up) { const t = [...up.querySelectorAll('div')].find(d => /aucune transmission/.test(d.textContent));
    if (t) t.textContent = 'JPG ou PNG · transmis au moteur Antéa (serveur local du cabinet)';
    const b = up.querySelector('b'); if (b) b.textContent = 'Ajouter le visuel à rechercher'; }
  const sub = document.querySelector('#form button[type="submit"]'); if (sub) sub.textContent = 'Lancer la recherche d’antériorités →';

  const RISQ = { 'élevé': 'eleve', 'moyen': 'moyen', 'faible': 'faible' };
  const badge = r => `<span class="ar-badge ${RISQ[(r || '').toLowerCase()] || 'moyen'}">Risque ${esc(r || '')}</span>`;
  const dfr = s => (s && s.length >= 8) ? `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}` : (s || '—');
  let timer = null;

  // Version en ligne (sans serveur) : window.ANTEA_DEMO contient une recherche réelle enregistrée,
  // rejouée étape par étape avec ses durées mesurées.
  const DEMO = window.ANTEA_DEMO || null;
  let demoDebut = 0;
  const URL_VISUEL = id => DEMO ? DEMO.base + 'visuel.jpg' : `/media/data/jobs/${id}/visuel.jpg`;
  const URL_PDF = id => DEMO ? DEMO.base + 'rapport.pdf' : `/api/recherche/${id}/rapport.pdf`;
  function etatDemo() {
    const j = JSON.parse(JSON.stringify(DEMO.job)), k = 0.6, e = (Date.now() - demoDebut) / 1000;
    let debut = 0, fini = true;
    j.etapes.forEach(x => {
      const fin = (x.t || 0) * k;
      if (e >= fin) x.etat = 'fait';
      else { fini = false; x.etat = e >= debut ? 'en_cours' : 'attente'; x.detail = ''; }
      debut = fin;
    });
    j.duree = Math.round(fini ? j.duree : e);
    if (!fini) { j.etat = 'en_cours'; delete j.avis; if (j.etapes[0].etat !== 'fait') delete j.analyse; }
    return j;
  }
  const lireEtat = async id => DEMO ? etatDemo() : (await fetch(`/api/recherche/${id}`)).json();

  function suivre(jobId) {
    clearInterval(timer);
    $('#ar-results').classList.add('hidden'); $('#ar-progress').classList.remove('hidden');
    $('#ar-img').src = URL_VISUEL(jobId);
    const tick = async () => {
      let j; try { j = await lireEtat(jobId); } catch (e) { return; }
      $('#ar-titre').textContent = j.meta.titre || 'Résultats de recherche';
      $('#ar-sub').textContent = `${j.meta.client || ''} · dossier ${j.meta.dossier || ''} · INPI, dessins et modèles FR et internationaux`;
      if (j.analyse) $('#ar-desc').textContent = j.analyse.description || '';
      $('#ar-chrono').textContent = j.etat === 'en_cours' ? `Temps écoulé : ${j.duree} s` : `Durée de la recherche : ${j.duree} s`;
      $('#ar-steps').innerHTML = j.etapes.map(e => `<div class="ar-step ${e.etat}"><div class="ic">${e.etat === 'fait' ? '✓' : e.etat === 'erreur' ? '!' : ''}</div>
        <div><b>${esc(e.libelle)}</b><div class="d">${esc(e.detail || (e.etat === 'en_cours' ? 'En cours…' : e.etat === 'attente' ? 'En attente' : ''))}</div></div></div>`).join('');
      if (j.etat === 'termine') { clearInterval(timer); afficher(j); }
      if (j.etat === 'erreur') { clearInterval(timer); toast('La recherche a échoué : ' + (j.erreur || '')); }
    };
    tick(); timer = setInterval(tick, 1200);
  }

  const PROX = { 'identique': 'eleve', 'très proche': 'moyen', 'proche': 'faible' };
  function webHtml(j) {
    const r = (j.web && j.web.resultats) || [];
    if (!r.length) return '';
    return `<h2 style="font:400 20px Georgia,serif;color:var(--gd);margin:22px 0 4px">Divulgations relevées sur le web</h2>
      <div class="subhead" style="margin-bottom:10px">Pages publiques montrant la création ou des dessins proches · ${(j.web.requetes || []).length} requêtes</div>
      <div class="ar-cards">${r.map(w => `<div class="ar-card"><div class="hd"><b style="color:var(--gd)">${esc(w.site || '')}</b>
        <span class="ar-badge ${PROX[(w.proximite || '').toLowerCase()] || 'faible'}">${esc(w.proximite || '')}</span></div>
        <div class="ar-top">${w.vignette ? `<img src="${w.vignette}" alt="">` : ''}<div class="meta"><div><b>${esc(w.titre || '')}</b></div>
        ${w.date ? `<div><b>Date :</b> ${esc(w.date)}</div>` : ''}</div></div>
        <div class="an">${esc(w.observations || '')}</div><a href="${esc(w.url)}" target="_blank" rel="noopener">Ouvrir la page ↗</a></div>`).join('')}</div>`;
  }

  function afficher(j) {
    const a = j.avis, g = a.appreciation_globale || {};
    const c = cases.find(x => x.jobId === j.id);
    if (c && c.status !== 'Rapport généré') { c.status = 'Résultats disponibles'; persist(); }
    $('#ar-results').innerHTML = `<div class="panelhead"><div><h2>${a.anteriorites.length} antériorité${a.anteriorites.length > 1 ? "s" : ""} retenue${a.anteriorites.length > 1 ? "s" : ""}</h2>
      <div class="subhead">sur ${j.nb_candidats} dépôts présélectionnés · ${j.requetes.filter(r => 'resultats' in r).length} requête(s) à l’API de l’INPI</div></div>
      <a class="btn" href="${URL_PDF(j.id)}" download>Télécharger le rapport (PDF)</a></div>
      <div class="ar-glob"><div style="flex:1"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px">
        <b style="color:var(--gd)">Appréciation globale du risque</b>${badge(g.niveau)}</div><div style="font-size:12.5px">${esc(g.synthese || '')}</div>
        <div style="font-size:12px;margin-top:8px;color:#7b1e2b"><b>Point clé :</b> ${esc(a.point_cle || '')}</div></div></div>
      <div class="ar-cards">${a.anteriorites.map((x, i) => `<div class="ar-card"><div class="hd"><b style="color:var(--gd)">Antériorité n° ${i + 1}</b>${badge(x.risque)}</div><div class="ar-top"><img src="${x.vignette}" alt="">
        <div class="meta">
        <div><b>Titre :</b> ${esc(x.titre)}</div><div><b>Titulaire :</b> ${esc(x.deposant)}</div>
        <div><b>Dépôt :</b> ${dfr(x.date_depot)} · ${esc(x.territoire)}</div><div><b>N° :</b> ${esc(x.numero)}-${esc(x.modele)}</div></div></div>
        <div class="an">${esc(x.analyse || '')}</div><a href="${x.lien}" target="_blank" rel="noopener">Voir la notice sur DATA INPI ↗</a></div>`).join('')}</div>
      ${webHtml(j)}
      <div class="ar-actions"><button class="btn alt" type="button" id="ar-to-reports">Compléter dans « Rapports »</button>
      <a class="btn" href="${URL_PDF(j.id)}" download>Télécharger le rapport (PDF)</a></div>`;
    $('#ar-progress').classList.add('hidden'); $('#ar-results').classList.remove('hidden');
    $('#ar-to-reports').onclick = () => { if (c) openReportForCase(c.id); else go('reports'); };
  }

  // --- soumission du formulaire « Créer une recherche »
  $('#form').onsubmit = async ev => {
    ev.preventDefault();
    const sel = selectedResearchSources();
    if (!sel.length) { toast('Sélectionnez au moins une source à consulter.'); $('#source-panel').open = true; return; }
    const f = $('#file').files[0];
    if (!f || !f.type.startsWith('image/')) { toast('Ajoutez le visuel à rechercher (JPG ou PNG).'); return; }
    const c = { id: 'ANT-' + String(27 + cases.length - 3).padStart(3, '0'), title: $('#title').value.trim(), client: $('#client').value.trim(),
      sector: $('#sector').value, date: new Date().toLocaleDateString('fr-FR'), status: 'Recherche en cours',
      sources: { mode: sel.length === researchSourceOptions.length ? 'all' : 'restricted', selected: sel }, territory: 'France, international' };
    if (!c.title || !c.client || !c.sector) return;
    const fd = new FormData();
    fd.append('image', f); fd.append('dossier', c.id); fd.append('titre', c.title); fd.append('client', c.client);
    fd.append('secteur', c.sector); fd.append('territoire', c.territory); fd.append('sources', sel.join('|')); fd.append('contexte', $('#context').value);
    if (DEMO) { c.jobId = DEMO.job.id; demoDebut = Date.now(); }
    else {
      let r;
      try { r = await fetch('/api/recherche', { method: 'POST', body: fd }); } catch (e) { toast('Moteur Antéa injoignable : lancez serve.py.'); return; }
      if (!r.ok) { toast('Le moteur a refusé la recherche.'); return; }
      c.jobId = (await r.json()).id;
    }
    cases.unshift(c); searchCount++; activity.unshift(['Recherche lancée', c.title]); persist();
    toast('Recherche lancée : sources interrogées et visuel en cours d’analyse.');
    go('resultats'); suivre(c.jobId);
  };

  // --- « Générer le rapport » : PDF du moteur si le dossier a une recherche
  const makeOrig = $('#make-report').onclick;
  $('#make-report').onclick = () => {
    const s = getReportDossierOptions().find(o => o.id === $('#report-case-select').value);
    if (s && s.caseRecord.jobId) {
      const cr = s.caseRecord; cr.status = 'Rapport généré'; cr.reportGenerated = true; cr.reportDate = new Date().toLocaleDateString('fr-FR');
      persist(); renderCases(); dashboard();
      const a = document.createElement('a'); a.href = URL_PDF(cr.jobId); a.download = ''; a.click();
      toast('Rapport PDF généré.'); return;
    }
    makeOrig();
  };

  // bouton « Consulter » de l'espace client : la fonction manquait dans le site d'origine
  if (typeof window.clientDetail !== 'function')
    window.clientDetail = t => toast(`Dossier « ${t} » : votre avocat vous transmettra le détail par la messagerie.`);

  // témoin de connexion du moteur (serveur local + Claude) dans la barre du haut
  const zone = document.querySelector('header.top > div:last-child');
  const pill = document.createElement('span');
  pill.id = 'ar-moteur'; pill.style.cssText = 'font-size:11px;border:1px solid var(--line);border-radius:20px;padding:4px 10px;background:#fffdf8;white-space:nowrap';
  pill.textContent = 'Moteur Antéa : vérification…';
  if (zone) zone.prepend(pill);
  if (DEMO) {
    pill.innerHTML = `<span style="color:var(--gold)">●</span> Version en ligne · recherche INPI réelle du ${DEMO.date}, rejouée`;
    pill.title = 'La recherche en direct (Claude + API INPI) tourne sur le moteur local du cabinet.';
    const n = document.createElement('div'); n.className = 'notice';
    n.innerHTML = `<b>Version en ligne :</b> le lancement rejoue une recherche réelle effectuée le ${DEMO.date} par le moteur Antéa (Claude et API de l’INPI) sur le carré « ${esc(DEMO.job.meta.titre || '')} ». Pour essayer : téléversez n’importe quelle image et lancez la recherche. La recherche en direct sur un nouveau visuel nécessite le moteur local du cabinet.`;
    const form = $('#form'); form.parentNode.insertBefore(n, form);
    const t = [...(up ? up.querySelectorAll('div') : [])].find(d => /moteur Antéa/.test(d.textContent));
    if (t) t.textContent = 'JPG ou PNG · version en ligne : rien n’est transmis';
  } else (async () => {
    try {
      const s = await (await fetch('/api/sante?claude=1')).json();
      pill.innerHTML = s.claude
        ? `<span style="color:#2f7d4f">●</span> Moteur Antéa connecté · Claude · INPI (${s.corpus} visuels)`
        : `<span style="color:#a84b3f">●</span> Claude non connecté`;
      if (!s.claude) pill.title = s.claude_detail || '';
    } catch (e) { pill.innerHTML = '<span style="color:#a84b3f">●</span> Moteur Antéa injoignable'; }
  })();

  // dernière recherche, si on recharge la page
  const last = cases.find(x => x.jobId);
  if (last && !DEMO) suivre(last.jobId);
})();
