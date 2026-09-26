#!/usr/bin/env python3
"""
What's new in research: three new astrophysics papers, in plain words.

Run once a day by .github/workflows/research-feed.yml. It
  1. fetches the newest astrophysics submissions from the arXiv API,
  2. asks Claude to pick three a curious non-scientist would enjoy and to
     explain each in a couple of plain sentences,
  3. writes them to a small JSON file that the website reads.

Without an ANTHROPIC_API_KEY it still picks three new papers, but shows the
opening of each abstract instead of a plain-language summary.

Uses only the Python standard library.

    python3 scripts/update_arxiv.py --out arxiv.json
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ARXIV_API = ('https://export.arxiv.org/api/query?search_query=cat:astro-ph.*'
             '&sortBy=submittedDate&sortOrder=descending&max_results=40')
ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
DEFAULT_MODEL = 'claude-opus-5-5'
TOPICS = ['Stars', 'The Sun', 'Planets', 'Galaxies', 'Black holes', 'Cosmology', 'Instruments']
NS = {'a': 'http://www.w3.org/2005/Atom', 'arxiv': 'http://arxiv.org/schemas/atom'}
# arXiv subject classes, for the fallback when there is no summary
CATEGORY_TOPIC = {
    'astro-ph.SR': 'Stars', 'astro-ph.EP': 'Planets', 'astro-ph.GA': 'Galaxies',
    'astro-ph.HE': 'Black holes', 'astro-ph.CO': 'Cosmology', 'astro-ph.IM': 'Instruments',
}

PROMPT = """You write the "What's new in research" panel on the personal website of an \
astrophysics PhD applicant who works on white dwarfs and binary stars. Visitors are mostly \
curious members of the public, students and a few scientists.

Below are the newest astrophysics papers on arXiv. Choose three that a curious \
non-scientist would find most interesting, on three different topics. If one of them is \
about white dwarfs, binary stars, stellar evolution, neutron stars or black holes, include it.

For each paper write:
- "headline": at most 10 words, plain and accurate, no hype, no jargon, no question marks.
- "summary": two or three short sentences, at most 60 words, in plain British English that \
a 14-year-old could follow. Say what the researchers did or found and why it matters. \
Explain any term a reader would need, or avoid it. Do not claim more certainty than the \
abstract does: use words like "suggests" or "may" where the authors do.
- "topic": exactly one of: {topics}.

Reply with JSON only, no other text, in this form:
{{"papers": [{{"id": "2609.12345", "headline": "...", "summary": "...", "topic": "..."}}]}}

Papers:
{papers}
"""


def fetch(url, data=None, headers=None, timeout=60, tries=3):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers or {'User-Agent': 'vaibhav3716.github.io research feed'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as err:          # network hiccups: wait and try again
            last = err
            time.sleep(10 * (attempt + 1))
    raise last


SYMBOLS = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε', 'eta': 'η', 'theta': 'θ',
    'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ', 'nu': 'ν', 'pi': 'π', 'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ',
    'phi': 'φ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω', 'Gamma': 'Γ', 'Delta': 'Δ', 'Lambda': 'Λ',
    'Sigma': 'Σ', 'Omega': 'Ω', 'odot': '☉', 'sun': '☉', 'oplus': '⊕', 'earth': '⊕',
    'sim': '∼', 'lesssim': '≲', 'gtrsim': '≳', 'approx': '≈', 'simeq': '≃', 'leq': '≤', 'le': '≤',
    'geq': '≥', 'ge': '≥', 'pm': '±', 'times': '×', 'cdot': '·', 'propto': '∝', 'infty': '∞',
    'rightarrow': '→', 'to': '→', 'prime': '′', 'deg': '°', 'circ': '°', 'AA': 'Å', 'kms': 'km/s',
    'msun': 'M☉', 'Msun': 'M☉',
}


def detex(s):
    """Plain text from arXiv titles and abstracts, which contain bits of LaTeX."""
    s = re.sub(r'\\(?:rm|mathrm|it|bf|textrm|text|mathit|mathbf|rm)\s*', '', s)
    s = re.sub(r'\\([A-Za-z]+)', lambda m: SYMBOLS.get(m.group(1), m.group(1)), s)
    s = s.replace('\\&', '&').replace('~', ' ').replace('--', '–')
    s = re.sub(r'\\[,;:! ]', ' ', s)
    s = re.sub(r'([_^])\{\s*', r'\1', s)      # β_{ eff} → β_eff
    s = re.sub(r'[${}\\]', '', s)
    # Numbers and charges as real sub- and superscripts: C_6H → C₆H, Na^+ → Na⁺, M_☉ → M☉
    s = re.sub(r'_([0-9+\-]+)', lambda m: m.group(1).translate(SUB), s)
    s = re.sub(r'\^([0-9+\-]+)', lambda m: m.group(1).translate(SUP), s)
    s = s.replace('_☉', '☉').replace('_⊕', '⊕')
    return ' '.join(s.split())


SUB = str.maketrans('0123456789+-', '₀₁₂₃₄₅₆₇₈₉₊₋')
SUP = str.maketrans('0123456789+-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻')


def short_authors(names):
    def initials(n):
        parts = n.split()
        return ' '.join([p[0] + '.' for p in parts[:-1]] + parts[-1:]) if len(parts) > 1 else n
    if len(names) <= 3:
        return ', '.join(initials(n) for n in names)
    return initials(names[0]) + ' et al.'


def latest_papers():
    root = ET.fromstring(fetch(ARXIV_API))
    papers = []
    for e in root.findall('a:entry', NS):
        cat = e.find('arxiv:primary_category', NS)
        cat = cat.get('term') if cat is not None else ''
        if not cat.startswith('astro-ph'):
            continue                      # cross-listed from physics; keep astronomy's own papers
        pid = re.sub(r'v\d+$', '', e.find('a:id', NS).text.split('/abs/')[-1])
        papers.append({
            'id': pid,
            'title': detex(e.find('a:title', NS).text),
            'abstract': detex(e.find('a:summary', NS).text),
            'authors': short_authors([a.find('a:name', NS).text for a in e.findall('a:author', NS)]),
            'category': cat,
            'published': e.find('a:published', NS).text[:10],
            'url': 'https://arxiv.org/abs/' + pid,
        })
    return papers


def summarise(papers, key, model):
    listing = '\n\n'.join('id: {id}\ncategory: {category}\ntitle: {title}\nabstract: {abstract}'.format(**p) for p in papers)
    body = {
        'model': model,
        'max_tokens': 1500,
        'messages': [{'role': 'user', 'content': PROMPT.format(topics=', '.join(TOPICS), papers=listing)}],
    }
    raw = fetch(ANTHROPIC_API, data=json.dumps(body).encode(), timeout=120, headers={
        'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
    })
    text = ''.join(b.get('text', '') for b in json.loads(raw).get('content', []))
    picks = json.loads(text[text.index('{'):text.rindex('}') + 1])['papers']
    by_id = {p['id']: p for p in papers}
    out = []
    for pick in picks:
        p = by_id.get(str(pick.get('id', '')).strip())
        headline, summary = str(pick.get('headline', '')).strip(), str(pick.get('summary', '')).strip()
        if not p or not headline or not summary or len(summary) > 500 or any(o['id'] == p['id'] for o in out):
            continue
        topic = pick.get('topic') if pick.get('topic') in TOPICS else CATEGORY_TOPIC.get(p['category'], 'Astrophysics')
        out.append(dict(p, headline=headline[:120], summary=summary, topic=topic))
    if len(out) < 3:
        raise ValueError('the model returned %d usable papers' % len(out))
    return out[:3]


def opening(abstract, limit=260):
    """The first sentence or two of an abstract, for when there is no plain summary."""
    out = ''
    for sentence in re.split(r'(?<=[.!?])\s+', abstract):
        if out and len(out) + len(sentence) > limit:
            break
        out = (out + ' ' + sentence).strip()
    return out if len(out) <= limit + 80 else out[:limit].rsplit(' ', 1)[0] + '…'


def without_summaries(papers):
    """Three of the newest papers, from different subject classes where possible."""
    chosen, seen = [], set()
    for p in papers:
        if p['category'] not in seen:
            chosen.append(p); seen.add(p['category'])
        if len(chosen) == 3:
            break
    for p in papers:
        if len(chosen) == 3:
            break
        if p not in chosen:
            chosen.append(p)
    return [dict(p, headline=p['title'], summary=opening(p['abstract']),
                 topic=CATEGORY_TOPIC.get(p['category'], 'Astrophysics')) for p in chosen]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, help='JSON file to write (its previous contents are kept if nothing changed)')
    args = ap.parse_args()

    previous = None
    if os.path.exists(args.out):
        with open(args.out) as f:
            previous = json.load(f)

    papers = latest_papers()
    if len(papers) < 3:
        sys.exit('arXiv returned too few astrophysics papers; keeping the current ones')

    key, model = os.environ.get('ANTHROPIC_API_KEY', '').strip(), os.environ.get('CLAUDE_MODEL', '').strip() or DEFAULT_MODEL
    # Same newest papers as last time (weekends, holidays): nothing to do, unless summaries can now be added
    if previous and previous.get('newest') == papers[0]['id'] and (previous.get('plain') or not key):
        print('No new papers since', previous.get('updated'))
        return

    plain = False
    if key:
        try:
            chosen, plain = summarise(papers, key, model), True
        except Exception as err:
            print('Plain-language summaries failed (%s); using the abstracts instead' % err, file=sys.stderr)
    if not plain:
        chosen = without_summaries(papers)

    feed = {
        'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'newest': papers[0]['id'],
        'plain': plain,
        'summarised_by': model if plain else None,
        'papers': [{k: p[k] for k in ('id', 'headline', 'summary', 'topic', 'title', 'authors', 'category', 'published', 'url')} for p in chosen],
    }
    with open(args.out, 'w') as f:
        json.dump(feed, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('Wrote', len(chosen), 'papers', '(plain summaries)' if plain else '(abstract openings)')


if __name__ == '__main__':
    main()
