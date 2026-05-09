(function () {
  "use strict";

  let allData = [];
  let selectedLokasi = null;
  let brushedNos   = null;

  const fmt     = d3.format(",.0f");
  
  // Perbaikan format harga: Miliar selalu digunakan
  const fmtHarga = v => {
    if (v === 0) return "0 M";
    return (v / 1e9).toFixed(1).replace(/\.0$/, '') + " M";
  };

  // Theme Toggle Logic
  const themeBtn = document.getElementById("theme-toggle");
  themeBtn.addEventListener("click", () => {
    const root = document.documentElement;
    const currentTheme = root.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    root.setAttribute("data-theme", newTheme);
    themeBtn.textContent = newTheme === "light" ? " Dark Mode" : " Light Mode";
  });

  function extractLokasi(nama) {
    const n = nama.toLowerCase();
    if (n.includes("gudang peluru"))                    return "Gudang Peluru";
    if (n.includes("menteng dalam"))                    return "Menteng Dalam";
    if (n.includes("kebon baru") || n.includes("kebun baru")) return "Kebon Baru";
    if (n.includes("asem baris") || n.includes("asembaris"))  return "Asem Baris";
    if (n.includes("bukit duri"))                       return "Bukit Duri";
    if (n.includes("tebet barat"))                      return "Tebet Barat";
    if (n.includes("tebet timur"))                      return "Tebet Timur";
    if (n.includes("tebet utara"))                      return "Tebet Utara";
    if (n.includes("tebet dalam"))                      return "Tebet Dalam";
    return "Tebet Lainnya";
  }

  function filtered() {
    let d = allData;
    if (selectedLokasi !== null) d = d.filter(r => r.lokasi === selectedLokasi);
    if (brushedNos     !== null) d = d.filter(r => brushedNos.has(r.no));
    return d;
  }

  fetch("Data/data.json")
    .then(r => r.json())
    .then(data => {
      allData = data.map(r => ({ ...r, lokasi: extractLokasi(r.nama) }));
      init();
    })
    .catch(err => {
      document.body.innerHTML = `<div style="color:#f59e0b;padding:40px;font-family:monospace">
        Error loading data.json: ${err.message}<br>
        Pastikan file data.json ada di folder Data/
      </div>`;
    });

  function init() {
    renderStats(allData);
    renderBarChart();
    renderScatter();
    updateVisibility();
    
    // Handle Window Resize agar responsif
    window.addEventListener("resize", () => {
      renderBarChart();
      renderScatter();
      updateVisibility();
    });
  }

  // Scatter Plot
  function renderScatter() {
    const container = document.getElementById("scatter-panel");
    const w = container.clientWidth - 48; // padding adj
    const h = container.clientHeight - 100;

    const margin = { top: 20, right: 30, bottom: 60, left: 80 }; // Left dinaikkan utk format M
    const W = w - margin.left - margin.right;
    const H = h - margin.top  - margin.bottom;

    const svg = d3.select("#scatter-svg").attr("viewBox", `0 0 ${w} ${h}`);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const lbMax = d3.quantile(allData.map(d => d.lb).sort(d3.ascending), 0.97);
    const hMax  = d3.quantile(allData.map(d => d.harga).sort(d3.ascending), 0.97);

    const xScale = d3.scaleLinear().domain([0, lbMax * 1.05]).range([0, W]);
    const yScale = d3.scaleLinear().domain([0, hMax  * 1.05]).range([H, 0]);

    // Grid
    g.append("g").attr("class", "grid")
      .attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(xScale).ticks(8).tickSize(-H).tickFormat(""));
    g.append("g").attr("class", "grid")
      .call(d3.axisLeft(yScale).ticks(8).tickSize(-W).tickFormat(""));

    // Axes
    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat(d => d + " m²"));
    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(yScale).ticks(8).tickFormat(fmtHarga));

    // Labels
    g.append("text").attr("class", "axis-label")
      .attr("x", W / 2).attr("y", H + 45).attr("text-anchor", "middle")
      .text("Luas Bangunan (m²)");
      
    g.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -H / 2).attr("y", -60).attr("text-anchor", "middle")
      .text("Harga Rumah (IDR)");

    const brush = d3.brush()
      .extent([[0, 0], [W, H]])
      .on("start brush", function (event) {
        if (!event.selection) return;
        const [[x0, y0], [x1, y1]] = event.selection;
        brushedNos = new Set(
          allData
            .filter(d => {
              const cx = xScale(Math.min(d.lb, lbMax));
              const cy = yScale(Math.min(d.harga, hMax));
              return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            })
            .map(d => d.no)
        );
        updateVisibility();
      })
      .on("end", function (event) {
        if (!event.selection) {
          brushedNos = null;
          updateVisibility();
        }
      });

    g.append("g").attr("class", "brush").call(brush);

    const tooltip = d3.select("#tooltip");

    const dots = g.selectAll(".dot")
      .data(allData, d => d.no)
      .join("circle")
      .attr("class", "dot")
      .attr("cx", d => xScale(Math.min(d.lb, lbMax)))
      .attr("cy", d => yScale(Math.min(d.harga, hMax)))
      .attr("r", 4) // Ukuran titik sedikit dinaikkan
      .on("mouseover", function (event, d) {
        d3.select(this).raise();
        tooltip.style("opacity", 1).html(`
          <div class="tt-name">${d.nama.length > 60 ? d.nama.slice(0,60)+"…" : d.nama}</div>
          <div class="tt-row">Harga<span>${fmtHarga(d.harga)}</span></div>
          <div class="tt-row">Luas Bangunan<span>${d.lb} m²</span></div>
          <div class="tt-row">Luas Tanah<span>${d.lt} m²</span></div>
          <div class="tt-row">Kamar Tidur<span>${d.kt} KT</span></div>
          <div class="tt-row">Kamar Mandi<span>${d.km} KM</span></div>
          <div class="tt-row">Garasi<span>${d.grs}</span></div>
          <div class="tt-row">Lokasi<span>${d.lokasi}</span></div>
        `);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", (event.clientX + 16) + "px")
          .style("top",  (event.clientY - 10) + "px");
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));
  }

  // Bar Chart
  function renderBarChart() {
    const panel = document.getElementById("bar-panel");
    const w = panel.clientWidth - 48;
    const h = 280; // Tinggi grafik diperbesar

    const lokasiCounts = d3.rollup(allData, v => v.length, d => d.lokasi);
    const data = Array.from(lokasiCounts, ([lokasi, count]) => ({ lokasi, count }))
      .sort((a, b) => b.count - a.count);

    const margin = { top: 20, right: 10, bottom: 65, left: 55 }; 
    const W = w - margin.left - margin.right;
    const H = h - margin.top  - margin.bottom;

    const svg = d3.select("#bar-svg").attr("viewBox", `0 0 ${w} ${h}`);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(data.map(d => d.lokasi))
      .range([0, W])
      .padding(0.25);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) * 1.15])
      .range([H, 0]);

    // Axes
    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
        .attr("transform", "rotate(-35)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.4em")
        .attr("dy", "0.6em");

    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("d")));

    // Axis Label Bar Chart Y
    g.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -H / 2)
      .attr("y", -35)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .text("Jumlah Unit");

    // Bars Group
    const bars = g.selectAll(".bar")
      .data(data, d => d.lokasi)
      .join("g")
      .attr("class", "bar")
      .style("cursor", "pointer")
      // Interaksi ditaruh di level Group agar mencakup visual & hitbox transparan
      .on("click", function (event, d) {
        if (selectedLokasi === d.lokasi) {
          selectedLokasi = null;
          document.getElementById("filter-tag").classList.add("hidden");
        } else {
          selectedLokasi = d.lokasi;
          const tag = document.getElementById("filter-tag");
          tag.classList.remove("hidden");
          tag.textContent = `✕  Filter: ${d.lokasi}`;
        }
        brushedNos = null;
        d3.select(".brush").call(d3.brush().clear);
        updateBarColors();
        updateVisibility();
      })
      .on("mouseover", function (event, d) {
        if (selectedLokasi !== d.lokasi)
          d3.select(this).select(".bar-visual").attr("fill", "var(--bar-hover)");
      })
      .on("mouseleave", function (event, d) {
        d3.select(this).select(".bar-visual").attr("fill",
          selectedLokasi === d.lokasi ? "var(--active-bar)" : "var(--inactive-bar)");
      });

    // 1. HITBOX TRANSPARAN (Memudahkan klik area kolom meski bar-nya pendek)
    bars.append("rect")
      .attr("class", "bar-hitbox")
      .attr("x", d => xScale(d.lokasi))
      .attr("y", 0) 
      .attr("width", xScale.bandwidth())
      .attr("height", H) 
      .attr("fill", "transparent");

    // 2. VISUAL BAR ASLI
    bars.append("rect")
      .attr("class", "bar-visual")
      .attr("x",      d => xScale(d.lokasi))
      .attr("y",      d => yScale(d.count))
      .attr("width",  xScale.bandwidth())
      .attr("height", d => H - yScale(d.count))
      .attr("fill",   d => selectedLokasi === d.lokasi ? "var(--active-bar)" : "var(--inactive-bar)")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1)
      .attr("rx", 3); // Lengkungan ujung batang (Rounded corners)

    bars.append("text")
      .attr("class", "bar-count")
      .attr("x", d => xScale(d.lokasi) + xScale.bandwidth() / 2)
      .attr("y", d => yScale(d.count) - 6)
      .attr("text-anchor", "middle")
      .text(d => d.count);
  }

  function updateBarColors() {
    // Ubah target pembaruan warna hanya ke ".bar-visual"
    d3.select("#bar-svg").selectAll(".bar-visual")
      .attr("fill", d => selectedLokasi === d.lokasi ? "var(--active-bar)" : "var(--inactive-bar)");
  }

  function updateVisibility() {
    const activeSet = new Set(filtered().map(d => d.no));

    d3.select("#scatter-svg").selectAll(".dot")
      .classed("highlighted", d =>  activeSet.has(d.no))
      .classed("dimmed",      d => !activeSet.has(d.no) && (selectedLokasi !== null || brushedNos !== null));

    renderStats(filtered());
  }

  // Stats
  function renderStats(data) {
    const count    = data.length;
    const avgHarga = data.length ? d3.mean(data,   d => d.harga) : 0;
    const avgLB    = data.length ? d3.mean(data,   d => d.lb)    : 0;
    const medHarga = data.length ? d3.median(data, d => d.harga) : 0;

    document.getElementById("stat-count").textContent     = fmt(count);
    document.getElementById("stat-avg-harga").textContent = fmtHarga(avgHarga);
    document.getElementById("stat-avg-lb").textContent    = fmt(avgLB);
    document.getElementById("stat-median").textContent    = fmtHarga(medHarga);
  }

  document.getElementById("filter-tag").addEventListener("click", () => {
    selectedLokasi = null;
    document.getElementById("filter-tag").classList.add("hidden");
    updateBarColors();
    updateVisibility();
  });

})();