
# Evaluating the Predictive Power of Technical Indicators in the MASI Index

![Python](https://img.shields.io/badge/Python-3.x-blue)
![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-orange)
![mlxtend](https://img.shields.io/badge/mlxtend-Apriori-green)
![Status](https://img.shields.io/badge/status-academic%20project-lightgrey)

A data mining project that measures how much information technical indicators carry about the **next-day direction of the MASI index** (Casablanca Stock Exchange).

The goal is a **measurement, not a trading bot**: if indicators beat random guessing on an emerging market, that is evidence against the weak-form Efficient Market Hypothesis.


---

## Key findings

- Technical indicators carry a **small but real signal**: Random Forest reaches roughly 53-54% accuracy against a ~53% "always predict UP" baseline.
- MASI falls into **three market regimes** (Bull, Bear, Crisis). K-Means, never told about COVID-19, placed March-April 2020 in the Crisis regime.
- The signal is **regime-dependent and unstable**: walk-forward validation (2022-2025) shows an edge over the baseline in 2022-2023 that fades in 2024 and reverses in 2025, a strong uptrend that broke the patterns learned from history.
- The model is better at **flagging drops** than finding rises, so it suits a risk alarm better than a buy signal.
- A linear model (Logistic Regression) matches the baseline exactly. The small gain comes from non-linear interactions between indicators.

---

## Pipeline

```
Raw OHLC prices -> Cleaning -> Feature engineering -> Descriptive analysis
      -> Association rules (Apriori) -> Regime detection (K-Means)
      -> Supervised models (Logistic Regression, Random Forest)
      -> Walk-forward validation -> Conclusion
```

| Step | What it does | Tools |
|---|---|---|
| 1. Data and cleaning | Daily MASI Open/High/Low/Close, Feb 2015 to Feb 2026 (Investing.com). Sorted chronologically, returns recomputed, extreme days kept on purpose | pandas, NumPy |
| 2. Feature engineering | Turns raw prices into indicators of **trend** (MA7, MA30, MA_Cross), **momentum** (RSI, MACD) and **volatility** (Bollinger width and position, ATR) | pandas |
| 3. Descriptive analysis | Univariate, bivariate and multivariate analysis: non-normal returns with fat tails, weak correlations, three independent groups of indicators (PCA) | SciPy, scikit-learn, Matplotlib, Seaborn |
| 4. Association rules | Discretizes indicators and mines "if X then UP/DOWN" rules, evaluated by support, confidence and lift | mlxtend (Apriori) |
| 5. Regime detection | Clusters days on 7 standardized features, K chosen with the elbow method | scikit-learn (StandardScaler, KMeans) |
| 6. Supervised models | Predicts next-day direction with a chronological split and a scaler fit on training data only | scikit-learn |
| 7. Walk-forward validation | Expanding window: train on all years before the test year, test on 2022, 2023, 2024, 2025 | scikit-learn |

### Technical indicators

| Family | Indicator | Meaning |
|---|---|---|
| Trend | MA7, MA30, MA_Cross | Short and medium moving averages and their difference (Golden / Death Cross) |
| Momentum | RSI (14) | Speed of recent gains vs losses; above 70 overbought, below 30 oversold |
| Momentum | MACD (12/26/9) | Gap between two exponential moving averages |
| Volatility | Bollinger Bands (20) | BB_Width = how nervous the market is; BB_Position = where price sits in the bands |
| Volatility | ATR (14) | Average daily range including gaps (replaces volume indicators, since volume was empty) |

### Avoiding data leakage

- Every feature on day *t* uses data up to day *t* only.
- The target is the **next-day** return sign (1 if above 0, else 0).
- Chronological split, no shuffling.
- Scaler fitted on training data only.
- Walk-forward validation instead of a single split.

---

## Repository structure

> Adjust this section to match your actual files.

```
.
├── data/              # Raw and cleaned MASI price data
├── notebooks/         # Analysis notebooks (one per step)
├── figures/           # Generated plots
├── report/            # Final report (PDF and LaTeX source)
├── requirements.txt
└── README.md
```

## Getting started

```bash
git clone https://github.com/zahrae12/<repo-name>.git
cd <repo-name>
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
jupyter notebook
```

Main dependencies: `pandas`, `numpy`, `scipy`, `scikit-learn`, `mlxtend`, `matplotlib`, `seaborn`, `jupyter`.

Then run the notebooks in order, from data cleaning to walk-forward validation.

---

## Limitations and future work

**Limitations**

- A single index (MASI), price-based features only.
- No transaction costs: accuracy is a statistical metric, not a backtest.
- Binary target ignores the size of moves.
- Association rules are descriptive and in-sample.
- Only four walk-forward test years.

**Future work**

- Regime-specific models using the Bull / Bear / Crisis labels.
- Online and adaptive learning.
- Macroeconomic and sentiment features.
- Sequence models (LSTM) and gradient boosting.
- Economic backtesting with transaction costs.

---


## Disclaimer

This project is for academic purposes only and is **not financial advice**. Results show a weak, unstable statistical signal and should not be used for trading decisions.
