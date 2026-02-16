// ─── STATE ────────────────────────────────────────────
let currentCharts = {};
let currentStratCharts = {};
let currentSymbol = "";
let liveInterval = null;
let refreshInterval = null;

// ─── ANALYZE STOCK ───────────────────────────────────
async function analyzeStock() {
    const symbol = document.getElementById("symbolInput").value.trim().toUpperCase();
    const period = document.getElementById("periodSelect").value;

    if (!symbol) {
        alert("Please enter a stock symbol!");
        return;
    }

    currentSymbol = symbol;

    // Show loading, hide others
    show("loading");
    hide("welcome");
    hide("metricsSection");
    hide("chartsSection");
    hide("newsSection");
    hide("strategySection");
    hide("optionsSection");

    try {
        const res = await fetch("/api/stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, period }),
        });

        const data = await res.json();

        if (data.error) {
            hide("loading");
            showError(data.error);
            return;
        }

        // Populate metrics
        populateMetrics(data.metrics);

        // Store charts
        currentCharts = data.charts;

        // Show first chart
        showChart("price", document.querySelector(".tab.active"));

        // Show sections
        hide("loading");
        show("metricsSection");
        show("chartsSection");

        // Add chat message
        addBotMessage(
            `✅ Analysis complete for <strong>${data.metrics.name} (${symbol})</strong>!<br><br>` +
            `💰 Price: <strong>$${data.metrics.currentPrice}</strong><br>` +
            `📈 ROI (${period}): <strong>${data.metrics.roi}%</strong><br>` +
            `🏢 Sector: ${data.metrics.sector}<br><br>` +
            `Click <strong>Analyze News</strong> for sentiment analysis!`
        );

    } catch (err) {
        hide("loading");
        showError("Failed to fetch stock data. Please try again.");
        console.error(err);
    }
}

// ─── ANALYZE NEWS ────────────────────────────────────
async function analyzeNews() {
    const symbol = document.getElementById("symbolInput").value.trim().toUpperCase() || currentSymbol;

    if (!symbol) {
        alert("Please enter a stock symbol first!");
        return;
    }

    show("loading");

    try {
        const res = await fetch("/api/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol }),
        });

        const data = await res.json();

        if (data.error) {
            hide("loading");
            showError(data.error);
            return;
        }

        // Populate news section
        populateNews(data);

        hide("loading");
        show("newsSection");

        // Scroll to news
        document.getElementById("newsSection").scrollIntoView({ behavior: "smooth" });

        // Chat message
        addBotMessage(
            `📰 News analysis for <strong>${symbol}</strong>:<br><br>` +
            `Overall: <strong>${data.summary.overall}</strong><br>` +
            `✅ Positive: ${data.summary.positive}<br>` +
            `❌ Negative: ${data.summary.negative}<br>` +
            `➖ Neutral: ${data.summary.neutral}`
        );

    } catch (err) {
        hide("loading");
        showError("Failed to fetch news data.");
        console.error(err);
    }
}

// ─── POPULATE METRICS ────────────────────────────────
function populateMetrics(m) {
    document.getElementById("stockTitle").innerHTML =
        `${m.name} <span style="color:#64748b">(${m.symbol})</span> — ${m.period.toUpperCase()}`;

    document.getElementById("mPrice").textContent = `$${m.currentPrice}`;

    const roiEl = document.getElementById("mROI");
    roiEl.textContent = `${m.roi > 0 ? "+" : ""}${m.roi}%`;
    roiEl.className = `metric-value ${m.roi >= 0 ? "positive" : "negative"}`;

    document.getElementById("mHigh").textContent = `$${m.high52w}`;
    document.getElementById("mLow").textContent = `$${m.low52w}`;
    document.getElementById("mCap").textContent = m.marketCap;
    document.getElementById("mPE").textContent = m.pe;
    document.getElementById("mEPS").textContent = m.eps;
    document.getElementById("mDiv").textContent = m.dividend;
    document.getElementById("mBeta").textContent = m.beta;
    document.getElementById("mVol").textContent = m.avgVolume;
    document.getElementById("mSector").textContent = m.sector;
    document.getElementById("mIndustry").textContent = m.industry;
}

// ─── SHOW CHART ──────────────────────────────────────
function showChart(type, tabEl) {
    // Update tabs
    document.querySelectorAll(".chart-tabs .tab").forEach(t => t.classList.remove("active"));
    if (tabEl) tabEl.classList.add("active");

    // Hide live bar when switching away from live tab
    hide("liveBar");

    const container = document.getElementById("chartContainer");

    if (currentCharts[type]) {
        const chartData = currentCharts[type];
        Plotly.newPlot(container, chartData.data, chartData.layout, {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
        });
    } else {
        container.innerHTML = `<div style="text-align:center;padding:60px;color:#94a3b8;">
            <h3>📉 Not enough data</h3>
            <p>Need more history for this indicator. Try a longer time period.</p>
        </div>`;
    }
}

// ─── POPULATE NEWS ───────────────────────────────────
function populateNews(data) {
    const summary = data.summary;

    // Summary badges
    document.getElementById("sentimentSummary").innerHTML = `
        <div class="sentiment-badge overall">
            Overall: <strong>${summary.overall}</strong>
        </div>
        <div class="sentiment-badge pos">✅ Positive: ${summary.positive}</div>
        <div class="sentiment-badge neg">❌ Negative: ${summary.negative}</div>
        <div class="sentiment-badge neu">➖ Neutral: ${summary.neutral}</div>
    `;

    // Sentiment chart
    if (data.sentimentChart) {
        const container = document.getElementById("sentimentChartContainer");
        Plotly.newPlot(container, data.sentimentChart.data, data.sentimentChart.layout, {
            responsive: true,
            displayModeBar: false,
        });
    }

    // News list
    const newsList = document.getElementById("newsList");

    if (data.news.length === 0) {
        newsList.innerHTML = `<div class="error-msg">No recent news found for this stock.</div>`;
        return;
    }

    newsList.innerHTML = data.news.map(n => `
        <div class="news-item">
            <div class="news-text">
                <div class="news-title">
                    <a href="${n.link}" target="_blank">${n.title}</a>
                </div>
                <div class="news-meta">${n.publisher} · ${n.date} · Score: ${n.score}</div>
            </div>
            <span class="news-sentiment-tag ${n.sentiment}">${n.sentiment}</span>
        </div>
    `).join("");
}

// ─── CHATBOT ─────────────────────────────────────────
async function sendChat() {
    const input = document.getElementById("chatInput");
    const message = input.value.trim();

    if (!message) return;

    // Add user message
    addUserMessage(message);
    input.value = "";

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
        });

        const data = await res.json();
        addBotMessage(formatBotReply(data.reply));

    } catch (err) {
        addBotMessage("⚠️ Sorry, something went wrong. Please try again.");
    }
}

function addUserMessage(text) {
    const container = document.getElementById("chatMessages");
    const div = document.createElement("div");
    div.className = "message user";
    div.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addBotMessage(html) {
    const container = document.getElementById("chatMessages");
    const div = document.createElement("div");
    div.className = "message bot";
    div.innerHTML = `<div class="message-content">${html}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function formatBotReply(text) {
    // Convert markdown-like bold and line breaks
    return text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code style='background:#1e293b;padding:2px 6px;border-radius:4px;font-size:0.85em'>$1</code>")
        .replace(/\n/g, "<br>")
        .replace(/• /g, "• ");
}

// ─── HELPERS ─────────────────────────────────────────
function show(id) {
    document.getElementById(id).classList.remove("hidden");
}

function hide(id) {
    document.getElementById(id).classList.add("hidden");
}

function showError(msg) {
    const dashboard = document.querySelector(".dashboard");
    const existing = dashboard.querySelector(".error-msg");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.className = "error-msg";
    div.textContent = msg;
    dashboard.prepend(div);

    setTimeout(() => div.remove(), 5000);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ─── KEYBOARD SHORTCUT ──────────────────────────────
document.getElementById("symbolInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") analyzeStock();
});

// ─── LIVE TICKER (SSE — Real-Time Stream) ────────────
let tickerSource = null;

function startTickerStream() {
    if (tickerSource) tickerSource.close();
    tickerSource = new EventSource("/stream/ticker");

    tickerSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.stocks && data.stocks.length > 0) {
                updateTickerUI(data.stocks, data.timestamp);
            }
        } catch (e) {
            console.error("Ticker SSE parse error:", e);
        }
    };

    tickerSource.onerror = () => {
        console.warn("Ticker SSE disconnected, reconnecting in 3s...");
        tickerSource.close();
        setTimeout(startTickerStream, 3000);
    };
}

function updateTickerUI(stocks, timestamp) {
    const tickerContent = document.getElementById("tickerContent");
    const html = stocks.map(s => {
        const color = s.change >= 0 ? "#00c853" : "#ff1744";
        const arrow = s.change >= 0 ? "▲" : "▼";
        const sign = s.change >= 0 ? "+" : "";
        return `<span class="ticker-item">
            <strong>${s.symbol}</strong>
            <span style="color:${color}">$${s.price} ${arrow} ${sign}${s.change} (${sign}${s.changePct}%)</span>
        </span>`;
    }).join("");

    tickerContent.innerHTML = html + html;
    document.getElementById("tickerTime").textContent = timestamp;

    // Flash the ticker bar to show it updated
    const bar = document.querySelector(".live-ticker-bar");
    bar.classList.add("ticker-flash");
    setTimeout(() => bar.classList.remove("ticker-flash"), 400);
}

// Start SSE ticker stream on page load
startTickerStream();

// ─── LIVE CHART (SSE — Real-Time Stream) ─────────────
let liveChartActive = false;
let chartSource = null;
let liveChartInitialized = false;

async function showLiveChart(tabEl) {
    if (!currentSymbol) {
        alert("Please analyze a stock first!");
        return;
    }

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    if (tabEl) tabEl.classList.add("active");

    liveChartActive = true;
    liveChartInitialized = false;
    show("liveBar");

    // Initial fetch to render chart immediately
    try {
        const res = await fetch("/api/livechart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol: currentSymbol }),
        });
        const data = await res.json();
        if (!data.error) {
            const container = document.getElementById("chartContainer");
            Plotly.newPlot(container, data.chart.data, data.chart.layout, {
                responsive: true, displayModeBar: true,
                modeBarButtonsToRemove: ["lasso2d", "select2d"],
            });
            updateLiveBar(data);
            liveChartInitialized = true;
        }
    } catch (e) {
        console.error("Initial live chart error:", e);
    }

    // Start SSE stream for real-time updates
    startChartStream(currentSymbol);
}

function startChartStream(symbol) {
    if (chartSource) chartSource.close();
    chartSource = new EventSource(`/stream/chart/${symbol}`);

    chartSource.onmessage = (event) => {
        if (!liveChartActive) return;
        try {
            const data = JSON.parse(event.data);
            const container = document.getElementById("chartContainer");

            // Build chart from streamed data
            const lineColor = data.change >= 0 ? "#00c853" : "#ff1744";
            const fillColor = data.change >= 0 ? "rgba(0,200,83,0.1)" : "rgba(255,23,68,0.1)";
            const sign = data.change >= 0 ? "+" : "";

            const traceData = [{
                x: data.times,
                y: data.prices,
                mode: "lines",
                line: { color: lineColor, width: 2.5 },
                fill: "tozeroy",
                fillcolor: fillColor,
                name: "Price",
                type: "scatter",
            }];

            const layout = {
                title: `${symbol} Live Intraday (${data.date || 'Today'}) — $${data.price} (${sign}${data.changePct}%)`,
                xaxis: { title: "Time" },
                yaxis: { title: "Price (USD)" },
                template: "plotly_dark",
                height: 450,
                margin: { l: 40, r: 40, t: 50, b: 40 },
                shapes: [{
                    type: "line", x0: data.times[0], x1: data.times[data.times.length - 1],
                    y0: data.open, y1: data.open,
                    line: { color: "#64748b", width: 1, dash: "dash" },
                }],
                annotations: [{
                    x: data.times[0], y: data.open,
                    text: `Open $${data.open}`, showarrow: false,
                    font: { color: "#64748b", size: 11 },
                    xanchor: "left", yanchor: "bottom",
                }],
            };

            Plotly.react(container, traceData, layout, {
                responsive: true, displayModeBar: true,
                modeBarButtonsToRemove: ["lasso2d", "select2d"],
            });

            updateLiveBar(data);

        } catch (e) {
            console.error("Chart SSE parse error:", e);
        }
    };

    chartSource.onerror = () => {
        if (liveChartActive) {
            console.warn("Chart SSE disconnected, reconnecting in 2s...");
            chartSource.close();
            setTimeout(() => {
                if (liveChartActive) startChartStream(symbol);
            }, 2000);
        }
    };
}

function updateLiveBar(data) {
    const color = data.change >= 0 ? "#00c853" : "#ff1744";
    const sign = data.change >= 0 ? "+" : "";

    const priceEl = document.getElementById("livePrice");
    priceEl.innerHTML = `<strong>$${data.price}</strong>`;
    priceEl.style.color = color;
    priceEl.classList.add("price-flash");
    setTimeout(() => priceEl.classList.remove("price-flash"), 500);

    document.getElementById("liveChange").innerHTML = `${sign}${data.change} (${sign}${data.changePct}%)`;
    document.getElementById("liveChange").style.color = color;
    document.getElementById("liveHighLow").textContent = `H: $${data.high} · L: $${data.low}`;
    document.getElementById("liveTimestamp").textContent = `Updated: ${data.timestamp}`;
    document.getElementById("mPrice").textContent = `$${data.price}`;
}

// Stop live chart when switching to other tabs
const origShowChart = showChart;
showChart = function(type, tabEl) {
    liveChartActive = false;
    if (chartSource) { chartSource.close(); chartSource = null; }
    origShowChart(type, tabEl);
};

// ─── STRATEGY ANALYSIS ──────────────────────────────
async function analyzeStrategy() {
    const symbol = document.getElementById("symbolInput").value.trim().toUpperCase() || currentSymbol;

    if (!symbol) {
        alert("Please enter a stock symbol first!");
        return;
    }

    show("loading");

    try {
        const res = await fetch("/api/strategy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol }),
        });

        const data = await res.json();

        if (data.error) {
            hide("loading");
            showError(data.error);
            return;
        }

        populateStrategy(data);
        currentStratCharts = data.charts;

        hide("loading");
        show("strategySection");

        // Show first strategy chart
        showStratChart("rsi", document.querySelector(".stab.active"));

        document.getElementById("strategySection").scrollIntoView({ behavior: "smooth" });

        // Chat message
        addBotMessage(
            `🧠 Strategy analysis for <strong>${symbol}</strong>:<br><br>` +
            `📊 RSI: <strong>${data.strategies.rsi.value}</strong> — ${data.strategies.rsi.signal}<br>` +
            `📈 MACD: <strong>${data.strategies.macd.interpretation}</strong><br>` +
            `📉 Bollinger: <strong>${data.strategies.bollinger.signal}</strong><br>` +
            `✨ MA Crossover: <strong>${data.strategies.maCrossover}</strong><br><br>` +
            `🎯 <strong>Overall: ${data.strategies.overall}</strong>`
        );

    } catch (err) {
        hide("loading");
        showError("Failed to fetch strategy data.");
        console.error(err);
    }
}

function populateStrategy(data) {
    const s = data.strategies;

    // Overall signal
    const overallEl = document.getElementById("overallSignal");
    let overallClass = "hold";
    if (s.overall.includes("BUY")) overallClass = "buy";
    else if (s.overall.includes("SELL")) overallClass = "sell";

    overallEl.innerHTML = `
        <div class="overall-signal-card ${overallClass}">
            <div class="overall-label">Overall Recommendation for ${data.symbol} @ $${data.price}</div>
            <div class="overall-value">${s.overall}</div>
        </div>
    `;

    // RSI
    document.getElementById("sRSIValue").textContent = s.rsi.value;
    const rsiSignalEl = document.getElementById("sRSISignal");
    rsiSignalEl.textContent = s.rsi.signal;
    rsiSignalEl.className = "strategy-signal " + getSignalClass(s.rsi.signal);

    // MACD
    document.getElementById("sMACDValue").textContent =
        `MACD: ${s.macd.macd} | Signal: ${s.macd.signal}`;
    const macdSignalEl = document.getElementById("sMACDSignal");
    macdSignalEl.textContent = s.macd.interpretation;
    macdSignalEl.className = "strategy-signal " + getSignalClass(s.macd.interpretation);

    // Bollinger
    document.getElementById("sBBValue").textContent =
        `Upper: $${s.bollinger.upper} | Lower: $${s.bollinger.lower}`;
    const bbSignalEl = document.getElementById("sBBSignal");
    bbSignalEl.textContent = s.bollinger.signal;
    bbSignalEl.className = "strategy-signal " + getSignalClass(s.bollinger.signal);

    // Support & Resistance
    document.getElementById("sSRValue").textContent =
        `Support: $${s.support} | Resistance: $${s.resistance}`;
    const srSignalEl = document.getElementById("sSRSignal");
    const pricePct = ((data.price - s.support) / (s.resistance - s.support) * 100).toFixed(0);
    srSignalEl.textContent = `Price at ${pricePct}% of range`;
    srSignalEl.className = "strategy-signal neutral";

    // MA Crossover
    const maSignalEl = document.getElementById("sMASignal");
    maSignalEl.textContent = s.maCrossover;
    maSignalEl.className = "strategy-signal " + getSignalClass(s.maCrossover);
}

function getSignalClass(text) {
    if (text.includes("🟢") || text.includes("Buy") || text.includes("Bullish") || text.includes("Oversold")) return "bullish";
    if (text.includes("🔴") || text.includes("Sell") || text.includes("Bearish") || text.includes("Overbought")) return "bearish";
    return "neutral";
}

function showStratChart(type, tabEl) {
    document.querySelectorAll(".stab").forEach(t => t.classList.remove("active"));
    if (tabEl) tabEl.classList.add("active");

    const container = document.getElementById("stratChartContainer");
    if (currentStratCharts[type]) {
        const chartData = currentStratCharts[type];
        Plotly.newPlot(container, chartData.data, chartData.layout, {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
        });
    }
}

// ─── OPTIONS ANALYSIS ─────────────────────────────────
let currentOptCharts = {};

async function analyzeOptions() {
    const symbol = document.getElementById("symbolInput").value.trim().toUpperCase() || currentSymbol;

    if (!symbol) {
        alert("Please enter a stock symbol first!");
        return;
    }

    show("loading");

    try {
        const res = await fetch("/api/options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol }),
        });

        const data = await res.json();

        if (data.error) {
            hide("loading");
            showError(data.error);
            return;
        }

        populateOptions(data);
        currentOptCharts = data.charts;

        hide("loading");
        show("optionsSection");

        showOptChart("putcall", document.querySelector(".otab.active"));

        document.getElementById("optionsSection").scrollIntoView({ behavior: "smooth" });

        // Chat message
        const ic = data.ironCondor;
        addBotMessage(
            `🎲 Options analysis for <strong>${symbol}</strong> (Exp: ${data.expiration}):<br><br>` +
            `📊 Put/Call Ratio (OI): <strong>${data.putCall.ratioOI}</strong> — ${data.putCall.signal}<br>` +
            `🌊 Avg IV: <strong>${data.iv.avgIV}%</strong> — ${data.iv.signal}<br>` +
            `🦅 Iron Condor: <strong>${ic.signal}</strong><br>` +
            (ic.sellPut > 0 ? `&nbsp;&nbsp;Sell Put $${ic.sellPut} / Buy Put $${ic.buyPut}<br>` +
            `&nbsp;&nbsp;Sell Call $${ic.sellCall} / Buy Call $${ic.buyCall}<br>` +
            `&nbsp;&nbsp;Net Credit: <strong>$${ic.netCredit}</strong> | Max Loss: $${ic.maxLoss}` : "")
        );

    } catch (err) {
        hide("loading");
        showError("Failed to fetch options data.");
        console.error(err);
    }
}

function populateOptions(data) {
    // Expiry header
    document.getElementById("optionsExpiry").innerHTML = `
        <div class="overall-signal-card hold">
            <div class="overall-label">${data.symbol} Options @ $${data.price}</div>
            <div class="overall-value">Expiration: ${data.expiration}</div>
        </div>
    `;

    // Put/Call Ratio
    document.getElementById("oPCValue").textContent =
        `OI Ratio: ${data.putCall.ratioOI} | Vol Ratio: ${data.putCall.ratioVolume}`;
    const pcSig = document.getElementById("oPCSignal");
    pcSig.textContent = data.putCall.signal;
    pcSig.className = "strategy-signal " + getSignalClass(data.putCall.signal);

    // IV
    document.getElementById("oIVValue").textContent =
        `Call IV: ${data.iv.callIV}% | Put IV: ${data.iv.putIV}% | Avg: ${data.iv.avgIV}%`;
    const ivSig = document.getElementById("oIVSignal");
    ivSig.textContent = data.iv.signal;
    ivSig.className = "strategy-signal " + getSignalClass(data.iv.signal);

    // Iron Condor
    const ic = data.ironCondor;
    if (ic.sellPut > 0) {
        document.getElementById("oICValue").innerHTML =
            `Buy Put $${ic.buyPut} → Sell Put $${ic.sellPut} | Sell Call $${ic.sellCall} → Buy Call $${ic.buyCall}`;
    } else {
        document.getElementById("oICValue").textContent = "N/A";
    }
    const icSig = document.getElementById("oICSignal");
    icSig.textContent = ic.signal;
    icSig.className = "strategy-signal " + getSignalClass(ic.signal);

    // Calls summary
    document.getElementById("oCallValue").textContent =
        `Vol: ${data.putCall.callVolume.toLocaleString()} | OI: ${data.putCall.callOI.toLocaleString()}`;
    document.getElementById("oCallSignal").textContent = "Bullish bets (right to buy)";
    document.getElementById("oCallSignal").className = "strategy-signal bullish";

    // Puts summary
    document.getElementById("oPutValue").textContent =
        `Vol: ${data.putCall.putVolume.toLocaleString()} | OI: ${data.putCall.putOI.toLocaleString()}`;
    document.getElementById("oPutSignal").textContent = "Bearish bets (right to sell)";
    document.getElementById("oPutSignal").className = "strategy-signal bearish";
}

function showOptChart(type, tabEl) {
    document.querySelectorAll(".otab").forEach(t => t.classList.remove("active"));
    if (tabEl) tabEl.classList.add("active");

    const container = document.getElementById("optChartContainer");
    if (currentOptCharts[type]) {
        const chartData = currentOptCharts[type];
        Plotly.newPlot(container, chartData.data, chartData.layout, {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
        });
    } else {
        container.innerHTML = `<div style="text-align:center;padding:60px;color:#94a3b8;">
            <h3>📉 No data available</h3>
            <p>Not enough options data for this chart.</p>
        </div>`;
    }
}

// ─── AUTO REFRESH ────────────────────────────────────
// Auto-refresh stock data every 60 seconds if a stock is being viewed
refreshInterval = setInterval(() => {
    if (currentSymbol) {
        // Silently refresh metrics (no loading spinner)
        const symbol = currentSymbol;
        const period = document.getElementById("periodSelect").value;
        fetch("/api/stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, period }),
        })
        .then(res => res.json())
        .then(data => {
            if (!data.error) {
                populateMetrics(data.metrics);
                currentCharts = data.charts;
                // Re-render active chart
                const activeTab = document.querySelector(".chart-tabs .tab.active");
                if (activeTab && !activeTab.classList.contains("live-tab")) {
                    const txt = activeTab.textContent;
                    const type = txt.includes("Price") ? "price" :
                                 txt.includes("ROI") ? "roi" :
                                 txt.includes("Volume") ? "volume" :
                                 txt.includes("Moving") ? "ma" :
                                 txt.includes("RSI") ? "rsi" :
                                 txt.includes("MACD") ? "macd" :
                                 txt.includes("Bollinger") ? "bollinger" : "price";
                    showChart(type, activeTab);
                }
            }
        })
        .catch(() => {});
    }
}, 60000);
