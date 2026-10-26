# Profound → Ranky: what to fix, and the angle

Collected 2026-10-27. **12 items from 3 sources: G2 (10), Trustpilot (1), Hacker News (1).** Every theme below is **thin**, meaning fewer than 3 reviews or a single source. Treat this as a direction, not a ranking.

Collection limits:
- G2 lists 1,133 reviews (836 five-star, 277 four, 16 three, 3 two, 1 one), but only the first page is public without a login.
- Capterra is behind a bot check, which we did not bypass.
- Reddit could not be opened from the research browser.
- Trustpilot has a single review.

Before betting on this, collect more: the 20 G2 reviews rated 1–3 stars (needs a login), Reddit "profound alternative / vs", and the r/SEO and r/bigseo threads.

One more caution: every G2 review in the sample was collected through a "Seller invite", and most are marked "Incentivized". That makes the sample skew positive, which is one more reason to read the complaints as signals, not a measure.

## 1. What they hate
1. **Too expensive for small companies.** 4 reviews (G2 only, thin).
   - Quote: "the price can be off-putting at first, especially if you are not a large company" ([G2](https://www.g2.com/products/profound/reviews/profound-review-12844958))
   - Quote: "rather expensive in comparison to other tools we've vetted" ([G2](https://www.g2.com/products/profound/reviews/profound-review-12960201))
   - Context: G2 lists Starter at $99/mo, Growth at $399/mo, and Enterprise on request.
2. **Steep learning curve; hard to know where to look or what terms mean.** 3 reviews (G2 only, thin).
   - Quote: "a significant learning curve" ([G2](https://www.g2.com/products/profound/reviews/profound-review-13368975))
   - Quote: "takes a bit of a learning curve to understand where to look for things and what certain terms mean" ([G2](https://www.g2.com/products/profound/reviews/profound-review-12855211))
   - Quote: "its not always obvious where to start" ([G2](https://www.g2.com/products/profound/reviews/profound-review-12972914))

## 2. What is missing
1. **An explanation of *why* the score changed, not just that it changed.** 1 review (thin), but it maps directly to something we can build.
   - Quote: "more context built into the dashboard explaining what's driving score changes, not just that they happened" ([G2](https://www.g2.com/products/profound/reviews/profound-review-12972914))
2. **Integrations and exports.** 2 reviews (thin), e.g. "not sure how to integrate it with other data platforms like ahrefs" ([G2](https://www.g2.com/products/profound/reviews/profound-review-12960201)).
3. **Per-model and per-country differences.** 1 review (thin). Quote: "clearer insight into how they differ by model and at the country level" ([G2](https://www.g2.com/products/profound/reviews/profound-review-12870153))
4. **Report customisation for different stakeholders.** 1 review (thin) ([G2](https://www.g2.com/products/profound/reviews/profound-review-12920609)).

## 3. What is unsolved
- **Small and local businesses.** Profound sells to enterprise marketing teams (its G2 page cites "10% of the Fortune 500"), and the price complaints name "not a large company". Nobody in the sample is a local business owner. That gap is Ranky's whole reason to exist. Evidence: the price theme above plus Profound's own positioning; still thin.

## 4. Fix plan

| # | Build / change | Size | Who | Evidence |
|---|---|---|---|---|
| 1 | **Sentiment, with reasons.** For every answer that names you, classify the tone as positive / neutral / negative and keep the exact phrase that drove it, so the owner sees *why*, not just a number. | M | this branch | "explaining what's driving score changes" (12972914). Profound has sentiment, but for enterprise. |
| 2 | **Fact check.** Compare what the engines say about the business (city, phone, website, hours, category) with the facts the owner gave. Flag wrong claims with the quote and the engine. | M | this branch | Profound ships "FactCheck"; local businesses lose customers to wrong hours and phone numbers. |
| 3 | **Plain-language "what changed" line** on the dashboard between two scans: score delta, plus which questions and which engine caused it. | S | follow-up | 12972914 |
| 4 | **Glossary tooltips** on every metric (score, mention rate, rank, sentiment). | S | follow-up | learning-curve theme (3 reviews) |
| 5 | Keep **one-page, ILS/USD small-business pricing**; no "contact us". | – | /replica-launch | price theme (4 reviews) |
| 6 | Per-engine breakdown of sentiment and facts (ChatGPT vs Gemini). | S | this branch | 12870153 |

## 5. The angle

**A.** For local business owners who find AI-visibility tools built for enterprise teams and priced like it, Ranky checks what ChatGPT and Gemini say about you, in plain words, from a free scan.
Evidence: price theme, 4 reviews, 1 source (thin).

**B.** For owners who see a number move and don't know why, Ranky shows the exact sentence each engine said, whether it was kind or not, and what it got wrong.
Evidence: "what's driving score changes" plus the learning-curve theme, 4 reviews, 1 source (thin).

**C.** For businesses that live on calls and walk-ins, Ranky catches the wrong phone number, the wrong hours and the wrong city that AI is telling customers.
Evidence: no review evidence in this sample. It is a product bet, not a finding.

**Recommended: A, with B as the proof.** A matches who Ranky already serves, and B is what the sentiment and fact-check features deliver. Do not use Profound's name in Ranky's name, ads or listing, and do not quote these reviewers on the site.
