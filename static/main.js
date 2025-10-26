// ==========================================================
// TwinTrap v2 — SPA + Fake WiFi Scanner + Live Chart + Alerts
// ==========================================================
(() => {
  document.addEventListener('DOMContentLoaded', () => {

    /** ------------------------
     *  Element references
     ------------------------ */
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = Array.from(document.querySelectorAll('.sidebar-menu a, a.nav-link'));
    const scanBtn = document.getElementById('scanBtn');
    const statusEl = document.getElementById('status');
    const resultsGrid = document.getElementById('resultsGridFull');
    const filterSelect = document.getElementById('filterVerdict');
    const countGood = document.getElementById('count-good');
    const countSuspicious = document.getElementById('count-suspicious');
    const countMalicious = document.getElementById('count-malicious');

    /** ------------------------
     *  SPA Navigation
     ------------------------ */
    const pages = ['home','analyze','results','about'];
    function navigate(page) {
      if (!pages.includes(page)) page = 'home';
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(page)?.classList.add('active');
      navLinks.forEach(a => a.classList.toggle('active', a.dataset.page === page));
      history.replaceState(null,'','#'+page);
    }
    window.showPage = navigate;
    navLinks.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.page);
    }));

    /** ------------------------
     *  Sidebar toggle
     ------------------------ */
    const updateToggleIcon = () => {
      if(menuToggle) menuToggle.textContent = sidebar.classList.contains('active') ? '✕' : '☰';
    };
    menuToggle?.addEventListener('click', e => {
      e.stopPropagation();
      sidebar.classList.toggle('active');
      updateToggleIcon();
    });
    document.addEventListener('click', e => {
      if(window.innerWidth <= 900 && sidebar && !sidebar.contains(e.target) && e.target !== menuToggle){
        sidebar.classList.remove('active'); updateToggleIcon();
      }
    });
    updateToggleIcon();

    /** ------------------------
     *  Fake WiFi Scanner + Live Chart
     ------------------------ */
    let scanning=false, scanTimer=null;
    let latestResults = [];

    // Chart.js setup
    const ctx = document.getElementById('scanChart')?.getContext('2d');
    const scanChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label:'Good', data:[], borderColor:'green', backgroundColor:'rgba(0,255,0,0.2)', fill:true },
          { label:'Suspicious', data:[], borderColor:'orange', backgroundColor:'rgba(255,165,0,0.2)', fill:true },
          { label:'Malicious', data:[], borderColor:'red', backgroundColor:'rgba(255,0,0,0.2)', fill:true }
        ]
      },
      options:{ responsive:true, animation:{duration:0}, scales:{y:{beginAtZero:true,max:10}}, plugins:{legend:{position:'top'}} }
    });

    // Random AP generator
    const randomAP = () => {
      const names = ['CoffeeNet','HomeWiFi','FreeAirport','TP-Link','Linksys','Starbucks','LibraryNet','GuestNet'];
      const ssid = names[Math.floor(Math.random()*names.length)] + (Math.random()>0.75?'-FREE':'');
      const bssid = 'AA:BB:CC:' + Math.floor(Math.random()*90+10).toString(16).toUpperCase();
      const rssi = Math.floor(Math.random()*60)-90;
      const enc = Math.random()>0.6?'WPA2':(Math.random()>0.85?'OPEN':'WPA3');
      const score = Math.max(0, Math.min(100, (enc==='OPEN'?20:enc==='WPA2'?70:90) + (rssi>-50?10:rssi>-70?0:-10)));
      const verdict = score>80?'good':score>50?'suspicious':'malicious';
      return {ssid,bssid,rssi,enc,score,verdict,channel:Math.ceil(Math.random()*11),timestamp:new Date().toISOString()};
    };

    // Render AP card
    const renderAP = ap => {
      const div = document.createElement('div');
      div.className = `ap-card ${ap.verdict}`;
      div.style.borderLeft = `6px solid ${ap.verdict==='good'?'green':ap.verdict==='suspicious'?'orange':'red'}`;
      div.style.background = ap.verdict==='good'?'rgba(0,255,0,0.05)':ap.verdict==='suspicious'?'rgba(255,165,0,0.08)':'rgba(255,0,0,0.1)';
      div.innerHTML = `<div class="ap-label">${ap.ssid}</div>
        <div class="ap-details">BSSID: <code>${ap.bssid}</code> • RSSI: ${ap.rssi} dBm • Channel: ${ap.channel} • ${ap.enc}</div>
        <div class="explanation">Score: ${ap.score} — ${ap.verdict.charAt(0).toUpperCase()+ap.verdict.slice(1)}</div>`;
      return div;
    };

    // Update chart & summary
    const updateChart = () => {
      const counts={good:0,suspicious:0,malicious:0};
      latestResults.forEach(r=>counts[r.verdict]++);
      scanChart.data.labels.push(new Date().toLocaleTimeString());
      scanChart.data.datasets[0].data.push(counts.good);
      scanChart.data.datasets[1].data.push(counts.suspicious);
      scanChart.data.datasets[2].data.push(counts.malicious);
      if(scanChart.data.labels.length>15){
        scanChart.data.labels.shift();
        scanChart.data.datasets.forEach(d=>d.data.shift());
      }
      scanChart.update('none');
      countGood.innerText = counts.good;
      countSuspicious.innerText = counts.suspicious;
      countMalicious.innerText = counts.malicious;
    };

    // Backend POST
    async function postScanPayload(results){
      try{
        const payload = {wifi_networks: results.map(s=>({ssid:s.ssid,bssid:s.bssid,signal:s.rssi,channel:s.channel,encryption:s.enc}))};
        const resp = await fetch('/api/upload',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        if(!resp.ok){ console.error('Upload failed', await resp.text()); return null; }
        return await resp.json();
      }catch(err){ console.error(err); return null; }
    }

    async function onNewScanBatch(batch){
      if(!batch?.length) return;
      const res = await postScanPayload(batch);
      if(res?.evil_twins?.length) showAlert(res.evil_twins);
    }

    // Start/Stop Scan
    const startScan = () => {
      if(scanning) return;
      scanning=true; latestResults=[]; resultsGrid.innerHTML='';
      scanBtn.innerText='Scanning...'; scanBtn.disabled=true;
      statusEl.innerText='Scanning — collecting nearby networks...';
      let count=0;
      scanTimer = setInterval(async ()=>{
        count++;
        const ap = randomAP();
        latestResults.unshift(ap);
        resultsGrid.prepend(renderAP(ap));
        updateChart();
        statusEl.innerText=`Scanning — found ${count} AP${count>1?'s':''}`;
        await onNewScanBatch([ap]);
        if(count>=12) stopScan();
      },400);
    };
    const stopScan = () => {
      clearInterval(scanTimer); scanning=false;
      scanBtn.innerText='Start Scan'; scanBtn.disabled=false;
      statusEl.innerText='Idle';
    };
    window.toggleScan = () => scanning?stopScan():startScan();
    scanBtn?.addEventListener('click', e=>{ e.preventDefault(); window.toggleScan(); });

    /** ------------------------
     *  Real-time alerts via Socket.IO
     ------------------------ */
    const socket = io();
    socket.on('connect', ()=>console.log('Socket connected',socket.id));
    socket.on('evil_twin_alert', data=>showAlert(data.ssids));

    function createAlertBox(){
      const div = document.createElement('div');
      div.id='alert-box';
      div.style.cssText="display:none;position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#ff004d;color:#fff;padding:12px 18px;border-radius:8px;z-index:2000;font-weight:bold;";
      document.body.appendChild(div);
      return div;
    }
    function showAlert(ssids){
      const box = document.getElementById('alert-box') || createAlertBox();
      box.innerHTML=`⚠️ Evil Twin Detected: ${ssids.join(', ')}`;
      box.style.display='block'; box.classList.add('blink');
      setTimeout(()=>{ box.style.display='none'; box.classList.remove('blink'); },9000);
    }

    /** ------------------------
     *  Filter results
     ------------------------ */
    filterSelect?.addEventListener('change', ()=>{
      const val = filterSelect.value;
      resultsGrid.querySelectorAll('.ap-card').forEach(card=>{
        card.style.display = val==='all' || card.classList.contains(val)?'block':'none';
      });
    });

    /** ------------------------
     *  Q&A accordion
     ------------------------ */
    document.querySelectorAll('.question').forEach(q=>q.addEventListener('click', ()=>{
      q.parentElement.classList.toggle('active');
    }));

    /** ------------------------
     *  Initial navigation
     ------------------------ */
    navigate(window.location.hash?.slice(1) || 'home');
  });
})();
