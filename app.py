from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import yfinance as yf
import pandas as pd
import json
import plotly
import plotly.graph_objects as go
from datetime import datetime, timedelta
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import requests
import re
import threading
import time
import numpy as np

app = Flask(__name__)
analyzer = SentimentIntensityAnalyzer()

# ─── LIVE PRICE CACHE (Background Thread) ────────────────
# Stores latest prices; updated every 2 seconds in background
live_cache = {
    "ticker": [],        # [{symbol, price, change, changePct}, ...]
    "charts": {},        # {symbol: {chart_data, price, change, ...}}
    "timestamp": "",
    "ticker_symbols": ["AAPL", "TSLA", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX"],
    "chart_symbol": None,
    "lock": threading.Lock(),
}


def _bg_update_ticker():
    """Background thread: refreshes ticker prices every 2 seconds."""
    while True:
        try:
            results = []
            for sym in live_cache["ticker_symbols"]:
                try:
                    t = yf.Ticker(sym)
                    h = t.history(period="2d")
                    if len(h) >= 2:
                        cur = round(h["Close"].iloc[-1], 2)
                        prev = round(h["Close"].iloc[-2], 2)
                        chg = round(cur - prev, 2)
                        pct = round((chg / prev) * 100, 2)
                    elif len(h) == 1:
                        cur = round(h["Close"].iloc[-1], 2)
                        chg = 0
                        pct = 0
                    else:
                        continue
                    results.append({"symbol": sym, "price": cur, "change": chg, "changePct": pct})
                except:
                    continue

            with live_cache["lock"]:
                live_cache["ticker"] = results
                live_cache["timestamp"] = datetime.now().strftime("%H:%M:%S")
        except:
            pass
        time.sleep(2)


def _bg_update_chart():
    """Background thread: refreshes live chart data every 3 seconds."""
    while True:
        sym = live_cache.get("chart_symbol")
        if sym:
            try:
                t = yf.Ticker(sym)
                h = t.history(period="1d", interval="1m")
                if h.empty:
                    h = t.history(period="5d", interval="5m")
                if not h.empty:
                    cur = round(h["Close"].iloc[-1], 2)
                    opn = round(h["Open"].iloc[0], 2)
                    chg = round(cur - opn, 2)
                    pct = round((chg / opn) * 100, 2)
                    hi = round(h["High"].max(), 2)
                    lo = round(h["Low"].min(), 2)
                    today = datetime.now().strftime("%b %d, %Y")

                    with live_cache["lock"]:
                        live_cache["charts"][sym] = {
                            "prices": h["Close"].tolist(),
                            "times": h.index.strftime("%Y-%m-%d %H:%M").tolist(),
                            "price": cur, "open": opn,
                            "change": chg, "changePct": pct,
                            "high": hi, "low": lo,
                            "date": today,
                            "timestamp": datetime.now().strftime("%H:%M:%S"),
                        }
            except:
                pass
        time.sleep(3)


# Start background threads (only once, avoid duplicate with reloader)
import os
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
    ticker_thread = threading.Thread(target=_bg_update_ticker, daemon=True)
    ticker_thread.start()
    chart_thread = threading.Thread(target=_bg_update_chart, daemon=True)
    chart_thread.start()


# ─── ROUTES ──────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stock", methods=["POST"])
def get_stock_data():
    """Return price history, key metrics, ROI, and charts for a ticker."""
    data = request.json
    symbol = data.get("symbol", "").upper().strip()
    period = data.get("period", "1y")  # 1mo, 3mo, 6mo, 1y, 5y, max

    if not symbol:
        return jsonify({"error": "Please provide a stock symbol"}), 400

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)

        if hist.empty:
            return jsonify({"error": f"No data found for '{symbol}'. Check the symbol."}), 404

        info = ticker.info

        # ── Key Metrics ──
        current_price = round(hist["Close"].iloc[-1], 2)
        start_price = round(hist["Close"].iloc[0], 2)
        roi = round(((current_price - start_price) / start_price) * 100, 2)
        high_52w = round(hist["Close"].max(), 2)
        low_52w = round(hist["Close"].min(), 2)
        avg_volume = int(hist["Volume"].mean())

        metrics = {
            "symbol": symbol,
            "name": info.get("shortName", symbol),
            "currentPrice": current_price,
            "startPrice": start_price,
            "roi": roi,
            "high52w": high_52w,
            "low52w": low_52w,
            "avgVolume": f"{avg_volume:,}",
            "marketCap": _format_number(info.get("marketCap", 0)),
            "pe": info.get("trailingPE", "N/A"),
            "eps": info.get("trailingEps", "N/A"),
            "dividend": info.get("dividendYield", 0),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "beta": info.get("beta", "N/A"),
            "period": period,
        }

        if metrics["dividend"] and metrics["dividend"] != "N/A":
            metrics["dividend"] = f"{round(metrics['dividend'] * 100, 2)}%"
        else:
            metrics["dividend"] = "N/A"

        if metrics["pe"] and metrics["pe"] != "N/A":
            metrics["pe"] = round(float(metrics["pe"]), 2)

        # ── Price Chart (Candlestick) ──
        price_chart = _build_candlestick(hist, symbol)

        # ── ROI Chart ──
        roi_chart = _build_roi_chart(hist, symbol)

        # ── Volume Chart ──
        volume_chart = _build_volume_chart(hist, symbol)

        # ── Moving Averages Chart ──
        ma_chart = _build_ma_chart(hist, symbol)

        # ── Strategy Charts (RSI, MACD, Bollinger) ──
        close = hist["Close"]
        strat_charts = {}

        if len(hist) >= 14:
            delta = close.diff()
            gain = delta.where(delta > 0, 0).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            strat_charts["rsi"] = _build_rsi_chart(hist, rsi, symbol)

        if len(hist) >= 26:
            ema12 = close.ewm(span=12, adjust=False).mean()
            ema26 = close.ewm(span=26, adjust=False).mean()
            macd_line = ema12 - ema26
            signal_line = macd_line.ewm(span=9, adjust=False).mean()
            macd_hist = macd_line - signal_line
            strat_charts["macd"] = _build_macd_chart(hist, macd_line, signal_line, macd_hist, symbol)

        if len(hist) >= 20:
            sma20 = close.rolling(20).mean()
            std20 = close.rolling(20).std()
            upper_band = sma20 + (std20 * 2)
            lower_band = sma20 - (std20 * 2)
            strat_charts["bollinger"] = _build_bollinger_chart(hist, sma20, upper_band, lower_band, symbol)

        return jsonify({
            "metrics": metrics,
            "charts": {
                "price": price_chart,
                "roi": roi_chart,
                "volume": volume_chart,
                "ma": ma_chart,
                **strat_charts,
            },
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/news", methods=["POST"])
def get_news_sentiment():
    """Fetch recent news headlines and run sentiment analysis."""
    data = request.json
    symbol = data.get("symbol", "").upper().strip()

    if not symbol:
        return jsonify({"error": "Please provide a stock symbol"}), 400

    try:
        ticker = yf.Ticker(symbol)
        news_items = ticker.news if hasattr(ticker, "news") else []

        results = []
        positive = 0
        negative = 0
        neutral = 0

        for item in news_items[:15]:
            title = item.get("title", "")
            publisher = item.get("publisher", "Unknown")
            link = item.get("link", "#")
            published = item.get("providerPublishTime", 0)

            if published:
                pub_date = datetime.fromtimestamp(published).strftime("%b %d, %Y")
            else:
                pub_date = "N/A"

            # Sentiment analysis on headline
            scores = analyzer.polarity_scores(title)
            compound = scores["compound"]

            if compound >= 0.05:
                sentiment = "Positive"
                positive += 1
            elif compound <= -0.05:
                sentiment = "Negative"
                negative += 1
            else:
                sentiment = "Neutral"
                neutral += 1

            results.append({
                "title": title,
                "publisher": publisher,
                "link": link,
                "date": pub_date,
                "sentiment": sentiment,
                "score": round(compound, 3),
            })

        total = positive + negative + neutral
        if total > 0:
            overall_score = round((positive - negative) / total, 2)
        else:
            overall_score = 0

        if overall_score > 0.2:
            overall = "Bullish 🟢"
        elif overall_score < -0.2:
            overall = "Bearish 🔴"
        else:
            overall = "Neutral 🟡"

        # Sentiment pie chart
        sentiment_chart = _build_sentiment_chart(positive, negative, neutral, symbol)

        return jsonify({
            "news": results,
            "summary": {
                "positive": positive,
                "negative": negative,
                "neutral": neutral,
                "overall": overall,
                "overallScore": overall_score,
            },
            "sentimentChart": sentiment_chart,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    """Simple chatbot that answers stock-related questions."""
    data = request.json
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"reply": "Please type a message."})

    reply = _process_chat(message)
    return jsonify({"reply": reply})


@app.route("/api/live", methods=["POST"])
def get_live_price():
    """Return cached live prices instantly."""
    with live_cache["lock"]:
        return jsonify({"stocks": live_cache["ticker"], "timestamp": live_cache["timestamp"]})


@app.route("/api/livechart", methods=["POST"])
def get_live_chart():
    """Return cached intraday chart data instantly."""
    data = request.json
    symbol = data.get("symbol", "").upper().strip()
    if not symbol:
        return jsonify({"error": "Please provide a stock symbol"}), 400

    # Tell background thread to track this symbol
    live_cache["chart_symbol"] = symbol

    with live_cache["lock"]:
        cached = live_cache["charts"].get(symbol)

    if not cached:
        # First request — fetch directly, cache will take over after
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1d", interval="1m")
            if hist.empty:
                hist = ticker.history(period="5d", interval="5m")
            if hist.empty:
                return jsonify({"error": f"No intraday data for '{symbol}'."}), 404

            cur = round(hist["Close"].iloc[-1], 2)
            opn = round(hist["Open"].iloc[0], 2)
            chg = round(cur - opn, 2)
            pct = round((chg / opn) * 100, 2)
            today = datetime.now().strftime("%b %d, %Y")

            cached = {
                "prices": hist["Close"].tolist(),
                "times": hist.index.strftime("%Y-%m-%d %H:%M").tolist(),
                "price": cur, "open": opn,
                "change": chg, "changePct": pct,
                "high": round(hist["High"].max(), 2),
                "low": round(hist["Low"].min(), 2),
                "date": today,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
            }
            with live_cache["lock"]:
                live_cache["charts"][symbol] = cached
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Build chart from cached data
    line_color = "#00c853" if cached["change"] >= 0 else "#ff1744"
    fill_color = "rgba(0,200,83,0.1)" if cached["change"] >= 0 else "rgba(255,23,68,0.1)"
    sign = "+" if cached["change"] >= 0 else ""

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=cached["times"], y=cached["prices"], mode="lines",
        line=dict(color=line_color, width=2.5),
        fill="tozeroy", fillcolor=fill_color, name="Price",
    ))
    fig.add_hline(y=cached["open"], line_dash="dash", line_color="#64748b", opacity=0.5,
                   annotation_text=f"Open ${cached['open']}")
    fig.update_layout(
        title=f"{symbol} Live Intraday ({cached.get('date', 'Today')}) — ${cached['price']} ({sign}{cached['changePct']}%)",
        xaxis_title="Time", yaxis_title="Price (USD)",
        template="plotly_dark", height=450,
        margin=dict(l=40, r=40, t=50, b=40),
    )
    chart = json.loads(plotly.io.to_json(fig))

    return jsonify({
        "chart": chart,
        "price": cached["price"], "open": cached["open"],
        "change": cached["change"], "changePct": cached["changePct"],
        "high": cached["high"], "low": cached["low"],
        "timestamp": cached["timestamp"],
    })


@app.route("/stream/ticker")
def stream_ticker():
    """SSE: Push live ticker data to client in real-time."""
    def generate():
        last_ts = ""
        while True:
            with live_cache["lock"]:
                ts = live_cache["timestamp"]
                data = live_cache["ticker"]
            if ts != last_ts and data:
                last_ts = ts
                payload = json.dumps({"stocks": data, "timestamp": ts})
                yield f"data: {payload}\n\n"
            time.sleep(1)
    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/stream/chart/<symbol>")
def stream_chart(symbol):
    """SSE: Push live chart data to client in real-time."""
    symbol = symbol.upper().strip()
    live_cache["chart_symbol"] = symbol

    def generate():
        last_ts = ""
        while True:
            with live_cache["lock"]:
                cached = live_cache["charts"].get(symbol)
            if cached and cached["timestamp"] != last_ts:
                last_ts = cached["timestamp"]
                payload = json.dumps({
                    "times": cached["times"],
                    "prices": cached["prices"],
                    "price": cached["price"], "open": cached["open"],
                    "change": cached["change"], "changePct": cached["changePct"],
                    "high": cached["high"], "low": cached["low"],
                    "date": cached.get("date", ""),
                    "timestamp": cached["timestamp"],
                })
                yield f"data: {payload}\n\n"
            time.sleep(1)
    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/api/strategy", methods=["POST"])
def get_strategy():
    """Calculate trading strategies: RSI, MACD, Bollinger Bands, signals."""
    data = request.json
    symbol = data.get("symbol", "").upper().strip()

    if not symbol:
        return jsonify({"error": "Please provide a stock symbol"}), 400

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1y")

        if hist.empty or len(hist) < 30:
            return jsonify({"error": f"Not enough data for '{symbol}' to calculate strategies."}), 404

        close = hist["Close"]
        current_price = round(close.iloc[-1], 2)

        # ── RSI (14-period) ──
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        current_rsi = round(rsi.iloc[-1], 2)

        if current_rsi > 70:
            rsi_signal = "Overbought — Consider Selling 🔴"
        elif current_rsi < 30:
            rsi_signal = "Oversold — Consider Buying 🟢"
        else:
            rsi_signal = "Neutral Range 🟡"

        # ── MACD ──
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - signal_line

        current_macd = round(macd_line.iloc[-1], 4)
        current_signal = round(signal_line.iloc[-1], 4)
        current_histogram = round(macd_hist.iloc[-1], 4)

        if current_macd > current_signal:
            macd_signal = "Bullish Crossover — Buy Signal 🟢"
        else:
            macd_signal = "Bearish Crossover — Sell Signal 🔴"

        # ── Bollinger Bands (20-period, 2 std) ──
        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        upper_band = sma20 + (std20 * 2)
        lower_band = sma20 - (std20 * 2)

        curr_upper = round(upper_band.iloc[-1], 2)
        curr_lower = round(lower_band.iloc[-1], 2)
        curr_sma = round(sma20.iloc[-1], 2)

        if current_price >= curr_upper:
            bb_signal = "Near Upper Band — Potentially Overbought 🔴"
        elif current_price <= curr_lower:
            bb_signal = "Near Lower Band — Potentially Oversold 🟢"
        else:
            bb_signal = "Within Normal Range 🟡"

        # ── Support & Resistance ──
        recent = close.tail(60)
        support = round(recent.min(), 2)
        resistance = round(recent.max(), 2)

        # ── Moving Average Crossover ──
        ma50 = close.rolling(50).mean()
        ma200 = close.rolling(200).mean() if len(close) >= 200 else None

        if ma200 is not None and not ma50.isna().iloc[-1] and not ma200.isna().iloc[-1]:
            if ma50.iloc[-1] > ma200.iloc[-1]:
                ma_cross_signal = "Golden Cross (MA50 > MA200) — Bullish 🟢"
            else:
                ma_cross_signal = "Death Cross (MA50 < MA200) — Bearish 🔴"
        else:
            ma_cross_signal = "Not enough data for MA200 crossover"

        # ── Overall Recommendation ──
        buy_signals = 0
        sell_signals = 0

        if current_rsi < 30: buy_signals += 1
        elif current_rsi > 70: sell_signals += 1

        if current_macd > current_signal: buy_signals += 1
        else: sell_signals += 1

        if current_price <= curr_lower: buy_signals += 1
        elif current_price >= curr_upper: sell_signals += 1

        if ma200 is not None and not ma50.isna().iloc[-1] and not ma200.isna().iloc[-1]:
            if ma50.iloc[-1] > ma200.iloc[-1]: buy_signals += 1
            else: sell_signals += 1

        if buy_signals > sell_signals:
            overall = f"BUY — {buy_signals} of {buy_signals+sell_signals} indicators bullish 🟢"
        elif sell_signals > buy_signals:
            overall = f"SELL — {sell_signals} of {buy_signals+sell_signals} indicators bearish 🔴"
        else:
            overall = f"HOLD — Signals are mixed 🟡"

        # ── Charts ──
        rsi_chart = _build_rsi_chart(hist, rsi, symbol)
        macd_chart = _build_macd_chart(hist, macd_line, signal_line, macd_hist, symbol)
        bb_chart = _build_bollinger_chart(hist, sma20, upper_band, lower_band, symbol)

        return jsonify({
            "symbol": symbol,
            "price": current_price,
            "strategies": {
                "rsi": {"value": current_rsi, "signal": rsi_signal},
                "macd": {
                    "macd": current_macd,
                    "signal": current_signal,
                    "histogram": current_histogram,
                    "interpretation": macd_signal,
                },
                "bollinger": {
                    "upper": curr_upper,
                    "lower": curr_lower,
                    "sma": curr_sma,
                    "signal": bb_signal,
                },
                "support": support,
                "resistance": resistance,
                "maCrossover": ma_cross_signal,
                "overall": overall,
            },
            "charts": {
                "rsi": rsi_chart,
                "macd": macd_chart,
                "bollinger": bb_chart,
            },
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/options", methods=["POST"])
def get_options():
    """Analyse options chain: Put/Call ratio, IV, Iron Condor strategy."""
    data = request.json
    symbol = data.get("symbol", "").upper().strip()

    if not symbol:
        return jsonify({"error": "Please provide a stock symbol"}), 400

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1y")
        if hist.empty:
            return jsonify({"error": f"No data found for '{symbol}'."}), 404

        current_price = round(hist["Close"].iloc[-1], 2)

        # Get options expiration dates
        try:
            exp_dates = ticker.options
        except Exception:
            exp_dates = []

        if not exp_dates:
            return jsonify({"error": f"No options data available for '{symbol}'. Options may not be listed."}), 404

        # Pick nearest expiration (about 30 days out)
        target_date = datetime.now() + timedelta(days=30)
        best_exp = exp_dates[0]
        for d in exp_dates:
            exp_dt = datetime.strptime(d, "%Y-%m-%d")
            if exp_dt >= target_date:
                best_exp = d
                break

        chain = ticker.option_chain(best_exp)
        calls = chain.calls
        puts = chain.puts

        if calls.empty and puts.empty:
            return jsonify({"error": f"Options chain is empty for '{symbol}'."}), 404

        # ── Put/Call Ratio ──
        call_vol = int(calls["volume"].sum()) if "volume" in calls.columns else 0
        put_vol = int(puts["volume"].sum()) if "volume" in puts.columns else 0
        call_oi = int(calls["openInterest"].sum()) if "openInterest" in calls.columns else 0
        put_oi = int(puts["openInterest"].sum()) if "openInterest" in puts.columns else 0

        pc_ratio_vol = round(put_vol / call_vol, 3) if call_vol > 0 else 0
        pc_ratio_oi = round(put_oi / call_oi, 3) if call_oi > 0 else 0

        if pc_ratio_oi > 1.2:
            pc_signal = "High Put/Call — Bearish Sentiment 🔴"
        elif pc_ratio_oi < 0.7:
            pc_signal = "Low Put/Call — Bullish Sentiment 🟢"
        else:
            pc_signal = "Neutral Put/Call Ratio 🟡"

        # ── Implied Volatility ──
        atm_calls = calls.iloc[(calls["strike"] - current_price).abs().argsort()[:3]]
        atm_puts = puts.iloc[(puts["strike"] - current_price).abs().argsort()[:3]]
        avg_call_iv = round(atm_calls["impliedVolatility"].mean() * 100, 2) if "impliedVolatility" in atm_calls.columns else 0
        avg_put_iv = round(atm_puts["impliedVolatility"].mean() * 100, 2) if "impliedVolatility" in atm_puts.columns else 0
        avg_iv = round((avg_call_iv + avg_put_iv) / 2, 2)

        if avg_iv > 50:
            iv_signal = "High IV — Premiums are expensive 🔴"
        elif avg_iv < 25:
            iv_signal = "Low IV — Premiums are cheap 🟢"
        else:
            iv_signal = "Moderate IV 🟡"

        # ── Iron Condor Setup ──
        # Find strikes: sell OTM put & call, buy further OTM for protection
        otm_puts = puts[puts["strike"] < current_price].sort_values("strike", ascending=False)
        otm_calls = calls[calls["strike"] > current_price].sort_values("strike", ascending=True)

        ic_result = {}
        if len(otm_puts) >= 2 and len(otm_calls) >= 2:
            sell_put = otm_puts.iloc[1]   # slightly OTM put (sell)
            buy_put = otm_puts.iloc[3] if len(otm_puts) > 3 else otm_puts.iloc[-1]  # further OTM (buy)
            sell_call = otm_calls.iloc[1]  # slightly OTM call (sell)
            buy_call = otm_calls.iloc[3] if len(otm_calls) > 3 else otm_calls.iloc[-1]  # further OTM (buy)

            sell_put_strike = round(float(sell_put["strike"]), 2)
            buy_put_strike = round(float(buy_put["strike"]), 2)
            sell_call_strike = round(float(sell_call["strike"]), 2)
            buy_call_strike = round(float(buy_call["strike"]), 2)

            # Premium collected
            sp_prem = round(float(sell_put.get("lastPrice", 0)), 2)
            bp_prem = round(float(buy_put.get("lastPrice", 0)), 2)
            sc_prem = round(float(sell_call.get("lastPrice", 0)), 2)
            bc_prem = round(float(buy_call.get("lastPrice", 0)), 2)

            net_credit = round((sp_prem + sc_prem) - (bp_prem + bc_prem), 2)
            put_width = round(sell_put_strike - buy_put_strike, 2)
            call_width = round(buy_call_strike - sell_call_strike, 2)
            max_width = max(put_width, call_width)
            max_loss = round(max_width - net_credit, 2) if max_width > net_credit else 0

            if net_credit > 0:
                ic_signal = f"Net Credit ${net_credit} — Profitable if price stays ${sell_put_strike}–${sell_call_strike} 🟢"
            else:
                ic_signal = "Net Debit — Not favorable setup 🔴"

            ic_result = {
                "sellPut": sell_put_strike,
                "buyPut": buy_put_strike,
                "sellCall": sell_call_strike,
                "buyCall": buy_call_strike,
                "netCredit": net_credit,
                "maxLoss": max_loss,
                "signal": ic_signal,
            }
        else:
            ic_result = {
                "sellPut": 0, "buyPut": 0, "sellCall": 0, "buyCall": 0,
                "netCredit": 0, "maxLoss": 0,
                "signal": "Not enough OTM options for Iron Condor 🟡",
            }

        # ── Charts ──
        pc_chart = _build_putcall_chart(calls, puts, symbol, best_exp)
        ic_chart = _build_iron_condor_chart(
            current_price, ic_result, symbol, best_exp
        ) if ic_result["sellPut"] > 0 else None

        return jsonify({
            "symbol": symbol,
            "price": current_price,
            "expiration": best_exp,
            "putCall": {
                "callVolume": call_vol,
                "putVolume": put_vol,
                "callOI": call_oi,
                "putOI": put_oi,
                "ratioVolume": pc_ratio_vol,
                "ratioOI": pc_ratio_oi,
                "signal": pc_signal,
            },
            "iv": {
                "callIV": avg_call_iv,
                "putIV": avg_put_iv,
                "avgIV": avg_iv,
                "signal": iv_signal,
            },
            "ironCondor": ic_result,
            "charts": {
                "putcall": pc_chart,
                "ironCondor": ic_chart,
            },
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── CHART BUILDERS ──────────────────────────────────────

def _build_candlestick(hist, symbol):
    fig = go.Figure(data=[go.Candlestick(
        x=hist.index.strftime("%Y-%m-%d").tolist(),
        open=hist["Open"].tolist(),
        high=hist["High"].tolist(),
        low=hist["Low"].tolist(),
        close=hist["Close"].tolist(),
        increasing_line_color="#00c853",
        decreasing_line_color="#ff1744",
    )])
    fig.update_layout(
        title=f"{symbol} Price Chart",
        xaxis_title="Date", yaxis_title="Price (USD)",
        template="plotly_dark",
        height=450,
        margin=dict(l=40, r=40, t=50, b=40),
        xaxis_rangeslider_visible=False,
    )
    return json.loads(plotly.io.to_json(fig))


def _build_roi_chart(hist, symbol):
    start = hist["Close"].iloc[0]
    roi_series = ((hist["Close"] - start) / start * 100).tolist()
    dates = hist.index.strftime("%Y-%m-%d").tolist()

    colors = ["#00c853" if v >= 0 else "#ff1744" for v in roi_series]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=dates, y=roi_series, mode="lines",
        line=dict(color="#00bcd4", width=2),
        fill="tozeroy",
        fillcolor="rgba(0,188,212,0.15)",
        name="ROI %",
    ))
    fig.add_hline(y=0, line_dash="dash", line_color="white", opacity=0.4)
    fig.update_layout(
        title=f"{symbol} ROI Over Time (%)",
        xaxis_title="Date", yaxis_title="ROI (%)",
        template="plotly_dark",
        height=400,
        margin=dict(l=40, r=40, t=50, b=40),
    )
    return json.loads(plotly.io.to_json(fig))


def _build_volume_chart(hist, symbol):
    dates = hist.index.strftime("%Y-%m-%d").tolist()
    volumes = hist["Volume"].tolist()

    fig = go.Figure(data=[go.Bar(
        x=dates, y=volumes,
        marker_color="#7c4dff",
        opacity=0.7,
    )])
    fig.update_layout(
        title=f"{symbol} Trading Volume",
        xaxis_title="Date", yaxis_title="Volume",
        template="plotly_dark",
        height=350,
        margin=dict(l=40, r=40, t=50, b=40),
    )
    return json.loads(plotly.io.to_json(fig))


def _build_ma_chart(hist, symbol):
    dates = hist.index.strftime("%Y-%m-%d").tolist()
    close = hist["Close"].tolist()

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=dates, y=close, name="Close", line=dict(color="#ffffff", width=1.5)))

    if len(hist) >= 20:
        ma20 = hist["Close"].rolling(20).mean().tolist()
        fig.add_trace(go.Scatter(x=dates, y=ma20, name="MA 20", line=dict(color="#ffeb3b", width=1.5, dash="dot")))

    if len(hist) >= 50:
        ma50 = hist["Close"].rolling(50).mean().tolist()
        fig.add_trace(go.Scatter(x=dates, y=ma50, name="MA 50", line=dict(color="#00bcd4", width=1.5, dash="dash")))

    if len(hist) >= 200:
        ma200 = hist["Close"].rolling(200).mean().tolist()
        fig.add_trace(go.Scatter(x=dates, y=ma200, name="MA 200", line=dict(color="#ff9800", width=2)))

    fig.update_layout(
        title=f"{symbol} Moving Averages",
        xaxis_title="Date", yaxis_title="Price (USD)",
        template="plotly_dark",
        height=400,
        margin=dict(l=40, r=40, t=50, b=40),
    )
    return json.loads(plotly.io.to_json(fig))


def _build_rsi_chart(hist, rsi, symbol):
    dates = hist.index.strftime("%Y-%m-%d").tolist()
    rsi_vals = rsi.tolist()

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=dates, y=rsi_vals, name="RSI", line=dict(color="#00bcd4", width=2)))
    fig.add_hline(y=70, line_dash="dash", line_color="#ff1744", opacity=0.6, annotation_text="Overbought (70)")
    fig.add_hline(y=30, line_dash="dash", line_color="#00c853", opacity=0.6, annotation_text="Oversold (30)")
    fig.add_hrect(y0=30, y1=70, fillcolor="rgba(255,255,255,0.03)", line_width=0)
    fig.update_layout(
        title=f"{symbol} RSI (14-Period)",
        xaxis_title="Date", yaxis_title="RSI",
        yaxis=dict(range=[0, 100]),
        template="plotly_dark", height=380,
        margin=dict(l=40, r=40, t=50, b=40),
    )
    return json.loads(plotly.io.to_json(fig))


def _build_macd_chart(hist, macd_line, signal_line, macd_hist, symbol):
    dates = hist.index.strftime("%Y-%m-%d").tolist()

    colors = ["#00c853" if v >= 0 else "#ff1744" for v in macd_hist.tolist()]

    fig = go.Figure()
    fig.add_trace(go.Bar(x=dates, y=macd_hist.tolist(), name="Histogram", marker_color=colors, opacity=0.5))
    fig.add_trace(go.Scatter(x=dates, y=macd_line.tolist(), name="MACD", line=dict(color="#00bcd4", width=2)))
    fig.add_trace(go.Scatter(x=dates, y=signal_line.tolist(), name="Signal", line=dict(color="#ff9800", width=2)))
    fig.update_layout(
        title=f"{symbol} MACD",
        xaxis_title="Date", yaxis_title="Value",
        template="plotly_dark", height=380,
        margin=dict(l=40, r=40, t=50, b=40),
    )
    return json.loads(plotly.io.to_json(fig))


def _build_bollinger_chart(hist, sma20, upper_band, lower_band, symbol):
    dates = hist.index.strftime("%Y-%m-%d").tolist()

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=dates, y=upper_band.tolist(), name="Upper Band", line=dict(color="#ff1744", width=1, dash="dot")))
    fig.add_trace(go.Scatter(x=dates, y=lower_band.tolist(), name="Lower Band", line=dict(color="#00c853", width=1, dash="dot"), fill="tonexty", fillcolor="rgba(255,255,255,0.03)"))
    fig.add_trace(go.Scatter(x=dates, y=sma20.tolist(), name="SMA 20", line=dict(color="#ffc107", width=1.5)))
    fig.add_trace(go.Scatter(x=dates, y=hist["Close"].tolist(), name="Close", line=dict(color="#ffffff", width=2)))
    fig.update_layout(
        title=f"{symbol} Bollinger Bands",
        xaxis_title="Date", yaxis_title="Price (USD)",
        template="plotly_dark", height=400,
        margin=dict(l=40, r=40, t=50, b=40),
    )
    return json.loads(plotly.io.to_json(fig))


def _build_putcall_chart(calls, puts, symbol, expiration):
    # Group by strike and show Open Interest for puts vs calls
    call_strikes = calls["strike"].tolist()
    call_oi = calls["openInterest"].fillna(0).tolist() if "openInterest" in calls.columns else []
    put_strikes = puts["strike"].tolist()
    put_oi = puts["openInterest"].fillna(0).tolist() if "openInterest" in puts.columns else []

    fig = go.Figure()
    fig.add_trace(go.Bar(x=call_strikes, y=call_oi, name="Call OI", marker_color="#00c853", opacity=0.7))
    fig.add_trace(go.Bar(x=put_strikes, y=put_oi, name="Put OI", marker_color="#ff1744", opacity=0.7))
    fig.update_layout(
        title=f"{symbol} Put/Call Open Interest — Exp: {expiration}",
        xaxis_title="Strike Price", yaxis_title="Open Interest",
        barmode="overlay", template="plotly_dark", height=400,
        margin=dict(l=40, r=40, t=50, b=40),
    )
    return json.loads(plotly.io.to_json(fig))


def _build_iron_condor_chart(current_price, ic, symbol, expiration):
    if ic["sellPut"] == 0:
        return None

    bp = ic["buyPut"]
    sp = ic["sellPut"]
    sc = ic["sellCall"]
    bc = ic["buyCall"]
    credit = ic["netCredit"]
    max_loss_put = round(sp - bp - credit, 2)
    max_loss_call = round(bc - sc - credit, 2)

    # Build payoff diagram
    import numpy as np
    prices = np.linspace(bp * 0.9, bc * 1.1, 300)
    payoff = []
    for p in prices:
        # Long put (buy put)
        lp = max(bp - p, 0)
        # Short put (sell put)
        spt = -max(sp - p, 0)
        # Short call (sell call)
        sct = -max(p - sc, 0)
        # Long call (buy call)
        lc = max(p - bc, 0)
        total = round(lp + spt + sct + lc + credit, 2)
        payoff.append(total)

    colors = ["#00c853" if v >= 0 else "#ff1744" for v in payoff]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=prices.tolist(), y=payoff, mode="lines",
        line=dict(color="#00bcd4", width=2.5),
        fill="tozeroy",
        fillcolor="rgba(0,188,212,0.1)",
        name="Payoff",
    ))
    fig.add_hline(y=0, line_dash="dash", line_color="#64748b", opacity=0.5)
    fig.add_vline(x=current_price, line_dash="dash", line_color="#ffc107", opacity=0.7,
                   annotation_text=f"Current ${current_price}")
    fig.add_vline(x=sp, line_dash="dot", line_color="#ff1744", opacity=0.4,
                   annotation_text=f"Sell Put ${sp}")
    fig.add_vline(x=sc, line_dash="dot", line_color="#00c853", opacity=0.4,
                   annotation_text=f"Sell Call ${sc}")
    fig.update_layout(
        title=f"{symbol} Iron Condor Payoff — Exp: {expiration} | Credit: ${credit}",
        xaxis_title="Stock Price at Expiry", yaxis_title="Profit / Loss ($)",
        template="plotly_dark", height=420,
        margin=dict(l=40, r=40, t=60, b=40),
    )
    return json.loads(plotly.io.to_json(fig))


def _build_sentiment_chart(pos, neg, neu, symbol):
    fig = go.Figure(data=[go.Pie(
        labels=["Positive", "Negative", "Neutral"],
        values=[pos, neg, neu],
        marker_colors=["#00c853", "#ff1744", "#ffc107"],
        hole=0.45,
        textinfo="label+percent",
    )])
    fig.update_layout(
        title=f"{symbol} News Sentiment",
        template="plotly_dark",
        height=350,
        margin=dict(l=20, r=20, t=50, b=20),
    )
    return json.loads(plotly.io.to_json(fig))


# ─── CHATBOT LOGIC ───────────────────────────────────────

def _process_chat(message):
    msg = message.lower()

    # Try to extract a stock symbol
    symbol_match = re.search(r'\b([A-Z]{1,5})\b', message)
    
    # Greetings
    if any(w in msg for w in ["hi", "hello", "hey"]):
        return ("👋 Hello! I'm your Stock Analysis Assistant.\n\n"
                "You can ask me things like:\n"
                "• **Analyze AAPL** — Full stock analysis\n"
                "• **What is the ROI of TSLA?**\n"
                "• **News for GOOGL** — Sentiment analysis\n"
                "• **Compare AAPL vs MSFT**\n"
                "• **What is PE ratio?** — Learn terms\n\n"
                "Just type a stock symbol or question!")

    # Definitions
    if "what is roi" in msg or "roi mean" in msg:
        return ("📊 **ROI (Return on Investment)** measures how much profit or loss "
                "an investment has generated relative to its cost.\n\n"
                "Formula: `ROI = ((Current Value - Initial Value) / Initial Value) × 100`\n\n"
                "Example: If you bought a stock at $100 and it's now $120, your ROI is **20%**.")

    if "what is pe" in msg or "p/e ratio" in msg or "pe ratio" in msg:
        return ("📊 **P/E Ratio (Price-to-Earnings)** shows how much investors pay per dollar of earnings.\n\n"
                "• **High P/E (>25)**: Investors expect high growth (could be overvalued)\n"
                "• **Low P/E (<15)**: Could be undervalued or slow growth\n\n"
                "It helps compare stocks within the same industry.")

    if "what is eps" in msg or "eps mean" in msg:
        return ("📊 **EPS (Earnings Per Share)** = Company's profit ÷ number of shares.\n\n"
                "Higher EPS = more profitable company. "
                "It's one of the most important metrics for valuing a stock.")

    if "what is market cap" in msg or "market cap mean" in msg:
        return ("📊 **Market Cap** = Stock Price × Total Shares Outstanding.\n\n"
                "• **Large Cap (>$10B)**: Stable, lower risk\n"
                "• **Mid Cap ($2B-$10B)**: Moderate growth & risk\n"
                "• **Small Cap (<$2B)**: Higher growth potential & risk")

    if "what is beta" in msg or "beta mean" in msg:
        return ("📊 **Beta** measures a stock's volatility vs the overall market.\n\n"
                "• **Beta > 1**: More volatile than market\n"
                "• **Beta = 1**: Moves with market\n"
                "• **Beta < 1**: Less volatile than market\n\n"
                "High beta = higher risk but potentially higher returns.")

    if any(w in msg for w in ["futures", "what is futures", "future trading"]):
        return ("📊 **Futures** are contracts to buy/sell an asset at a future date at a set price.\n\n"
                "• Used for hedging or speculation\n"
                "• Trade on commodities, indices, currencies\n"
                "• High leverage = high risk\n"
                "• Expiry dates matter — must close or roll over positions")

    if any(w in msg for w in ["options", "what is options", "option trading"]):
        return ("📊 **Options** give you the RIGHT (not obligation) to buy/sell a stock at a set price.\n\n"
                "• **Call Option**: Right to BUY (bullish bet)\n"
                "• **Put Option**: Right to SELL (bearish bet)\n"
                "• **Premium**: The price you pay for the option\n"
                "• **Strike Price**: The set price\n"
                "• **Expiry**: When the option expires\n\n"
                "Options are great for hedging and leveraged bets!")

    if "help" in msg:
        return ("🤖 **Stock Chatbot Commands:**\n\n"
                "📈 **Analyze a stock**: Type the stock symbol (e.g., AAPL, TSLA)\n"
                "📰 **News sentiment**: Click 'Analyze News' button\n"
                "📊 **Learn terms**: Ask 'What is ROI?', 'What is PE ratio?'\n"
                "🔄 **Change period**: Use the period dropdown\n\n"
                "I analyze real-time stock data with charts, ROI, and news sentiment!")

    # If they mention a symbol, prompt them to use the search
    if symbol_match:
        sym = symbol_match.group(1)
        return (f"🔍 Looking for **{sym}**? \n\n"
                f"Type **{sym}** in the search bar above and click **Analyze** "
                f"to get full analysis with:\n"
                f"• 📈 Price & Candlestick charts\n"
                f"• 📊 ROI graph\n"
                f"• 📉 Volume & Moving Averages\n"
                f"• 📰 News sentiment analysis\n\n"
                f"Or click **Analyze News** for sentiment breakdown!")

    return ("🤔 I didn't quite get that. Try asking:\n\n"
            "• **Analyze AAPL** or any stock symbol\n"
            "• **What is ROI / PE / EPS / Beta?**\n"
            "• **What are options / futures?**\n"
            "• Type **help** for all commands")


# ─── HELPERS ─────────────────────────────────────────────

def _format_number(num):
    if not num or num == "N/A":
        return "N/A"
    num = float(num)
    if num >= 1e12:
        return f"${num/1e12:.2f}T"
    elif num >= 1e9:
        return f"${num/1e9:.2f}B"
    elif num >= 1e6:
        return f"${num/1e6:.2f}M"
    else:
        return f"${num:,.0f}"


if __name__ == "__main__":
    app.run(debug=True, port=5000)
