#!/usr/bin/env python3
"""
What's new in research: three new astrophysics papers, in plain words.

Run once a day by .github/workflows/research-feed.yml. It
  1. fetches the newest astrophysics papers from arXiv (its search API, or its
     RSS feed if the API won't answer),
  2. asks Claude to pick three a curious non-scientist would enjoy and to
     explain each in a couple of plain sentences,
  3. writes them to a small JSON file that the website reads.

Without an ANTHROPIC_API_KEY it still picks three new papers, but shows the
opening of each abstract instead of a plain-language summary. If arXiv can't be
reached at all, the current papers are kept and the run ends with a warning
rather than a failure.

Problems are reported as GitHub annotations, which appear on the run's page
and in the notification email without needing to open the full log.

Needs the `anthropic` package only when there is an API key:

    pip install anthropic
    python3 scripts/update_arxiv.py --out arxiv.json
"""
import argparse
import email.utils
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ARXIV_API = ('https://export.arxiv.org/api/query?search_query=cat:astro-ph.*'
             '&sortBy=submittedDate&sortOrder=descending&max_results=40')
ARXIV_RSS = 'https://rss.arxiv.org/rss/astro-ph'
USER_AGENT = 'vaibhav3716.github.io research feed (+https://vaibhav3716.github.io)'
DEFAULT_MODEL = 'claude-sonnet-5'   # plenty for three short summaries a day; set CLAUDE_MODEL to override
EFFORT = 'medium'                   # how hard the model thinks; summarising abstracts doesn't need more
TOPICS = ['Stars', 'The Sun', 'Planets', 'Galaxies', 'Black holes', 'Cosmology', 'Instruments']
NS = {'a': 'http://www.w3.org/2005/Atom', 'arxiv': 'http://arxiv.org/schemas/atom',
      'dc': 'http://purl.org/dc/elements/1.1/'}
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

For each paper give its id exactly as listed, and write:
- "headline": at most 10 words, plain and accurate, no hype, no jargon, no question marks.
- "summary": two or three short sentences, at most 60 words, in plain British English that \
a 14-year-old could follow. Say what the researchers did or found and why it matters. \
Explain any term a reader would need, or avoid it. Do not claim more certainty than the \
abstract does: use words like "suggests" or "may" where the authors do.
- "topic": the one that fits best.

Papers:
{papers}
"""

# The reply must be exactly this shape (structured outputs), so it always parses
SCHEMA = {
    'type': 'object',
    'properties': {
        'papers': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'id': {'type': 'string'},
                    'headline': {'type': 'string'},
                    'summary': {'type': 'string'},
                    'topic': {'type': 'string', 'enum': TOPICS},
                },
                'required': ['id', 'headline', 'summary', 'topic'],
                'additionalProperties': False,
            },
        },
    },
    'required': ['papers'],
    'additionalProperties': False,
}


class Unavailable(Exception):
    """arXiv could not be reached, or had no new papers."""


class SummaryError(Exception):
    """Claude could not write the summaries; the reason is safe to show on the run page."""


def note(level, title, message):
    """Report a problem as a GitHub annotation (visible without signing in), or on stderr locally."""
    if os.environ.get('GITHUB_ACTIONS'):
        esc = lambda s: s.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print('::%s title=%s::%s' % (level, esc(title).replace(':', '%3A').replace(',', '%2C'), esc(message)))
    else:
        print('%s: %s. %s' % (level.upper(), title, message), file=sys.stderr)


def get(url, timeout=60, tries=3):
    """Fetch a URL politely: identify ourselves, and wait as long as the server asks before retrying."""
    problems = []
    for attempt in range(tries):
        wait = (20, 60)[min(attempt, 1)]
        try:
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as err:
            problems.append('HTTP %d %s' % (err.code, err.reason))
            retry_after = (err.headers.get('Retry-After') or '').strip()
            if retry_after.isdigit():
                wait = max(wait, int(retry_after))
        except Exception as err:          # timeouts, refused or dropped connections
            problems.append('%s: %s' % (type(err).__name__, err))
        print('  attempt %d of %d failed: %s' % (attempt + 1, tries, problems[-1]), file=sys.stderr)
        if attempt < tries - 1:
            time.sleep(min(wait, 180))
    raise Unavailable('; '.join(problems))


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
SUB = str.maketrans('0123456789+-', '₀₁₂₃₄₅₆₇₈₉₊₋')
SUP = str.maketrans('0123456789+-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻')


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


def short_authors(names):
    def initials(n):
        parts = n.split()
        return ' '.join([p[0] + '.' for p in parts[:-1]] + parts[-1:]) if len(parts) > 1 else n
    if len(names) <= 3:
        return ', '.join(initials(n) for n in names)
    return initials(names[0]) + ' et al.'


def paper(pid, title, abstract, names, category, published):
    pid = re.sub(r'v\d+$', '', pid.strip())
    return {'id': pid, 'title': detex(title), 'abstract': detex(abstract), 'authors': short_authors(names),
            'category': category, 'published': published, 'url': 'https://arxiv.org/abs/' + pid}


def from_api():
    """The newest submissions, from the arXiv search API."""
    root = ET.fromstring(get(ARXIV_API))
    papers = []
    for e in root.findall('a:entry', NS):
        cat = e.find('arxiv:primary_category', NS)
        cat = cat.get('term') if cat is not None else ''
        if not cat.startswith('astro-ph'):
            continue                      # cross-listed from physics; keep astronomy's own papers
        papers.append(paper(e.find('a:id', NS).text.split('/abs/')[-1], e.find('a:title', NS).text,
                            e.find('a:summary', NS).text, [a.find('a:name', NS).text for a in e.findall('a:author', NS)],
                            cat, e.find('a:published', NS).text[:10]))
    return papers


def from_rss():
    """Today's new papers, from the astro-ph RSS feed (a separate arXiv service). Empty at weekends."""
    root = ET.fromstring(get(ARXIV_RSS))
    papers = []
    for it in root.findall('./channel/item'):
        kind = it.find('arxiv:announce_type', NS)
        if kind is None or (kind.text or '').strip() != 'new':
            continue                      # skip replacements and papers cross-listed from elsewhere
        cats = [c.text.strip() for c in it.findall('category') if c.text]
        cat = cats[0] if cats else 'astro-ph'
        if not cat.startswith('astro-ph'):
            continue
        creator = it.find('dc:creator', NS)
        names = [n.strip() for n in ((creator.text or '') if creator is not None else '').split(',') if n.strip()]
        abstract = (it.find('description').text or '').split('Abstract:', 1)[-1]
        try:
            published = email.utils.parsedate_to_datetime(it.find('pubDate').text).date().isoformat()
        except Exception:
            published = datetime.now(timezone.utc).date().isoformat()
        papers.append(paper(it.find('link').text.split('/abs/')[-1], it.find('title').text, abstract, names, cat, published))
    return papers


def latest_papers():
    """The newest astronomy papers, and where they came from. Tries the API first, then the RSS feed."""
    problems = []
    for name, source in (('arXiv API', from_api), ('arXiv RSS feed', from_rss)):
        try:
            papers = source()
        except Exception as err:
            problems.append('%s: %s' % (name, err))
            continue
        if len(papers) >= 3:
            return papers, name
        problems.append('%s: only %d astronomy papers' % (name, len(papers)))
    raise Unavailable(' | '.join(problems))


def api_message(err):
    """The human-readable part of an API error, e.g. "Your credit balance is too low..." """
    body = getattr(err, 'body', None)
    if isinstance(body, dict) and isinstance(body.get('error'), dict) and body['error'].get('message'):
        return body['error']['message']
    return getattr(err, 'message', str(err))


def summarise(papers, model):
    """Ask Claude to choose three papers and explain them. Raises SummaryError with a readable reason."""
    import anthropic                      # only needed when there is an API key

    listing = '\n\n'.join('id: {id}\ncategory: {category}\ntitle: {title}\nabstract: {abstract}'.format(**p) for p in papers)
    client = anthropic.Anthropic(max_retries=4, timeout=180.0)   # reads ANTHROPIC_API_KEY
    try:
        response = client.messages.create(
            model=model,
            max_tokens=16000,             # room for the model's thinking as well as the three summaries
            output_config={'effort': EFFORT, 'format': {'type': 'json_schema', 'schema': SCHEMA}},
            messages=[{'role': 'user', 'content': PROMPT.format(papers=listing)}],
        )
    except anthropic.AuthenticationError:
        raise SummaryError('the ANTHROPIC_API_KEY secret was not accepted; check it in the repository settings')
    except anthropic.PermissionDeniedError as err:
        raise SummaryError('the API key is not allowed to do this: %s' % api_message(err))
    except anthropic.NotFoundError:
        raise SummaryError('the model %r was not found; check the CLAUDE_MODEL variable' % model)
    except anthropic.RateLimitError as err:
        raise SummaryError('rate limited by the Claude API: %s' % api_message(err))
    except anthropic.BadRequestError as err:
        raise SummaryError(api_message(err))   # for example, a credit balance that has run out
    except anthropic.APIStatusError as err:
        raise SummaryError('Claude API error %d: %s' % (err.status_code, api_message(err)))
    except anthropic.APIConnectionError:
        raise SummaryError('could not reach the Claude API')

    if response.stop_reason == 'refusal':
        raise SummaryError('the model declined this request')
    if response.stop_reason == 'max_tokens':
        raise SummaryError('the reply was cut off before it finished')
    text = next((b.text for b in response.content if b.type == 'text'), '')
    try:
        picks = json.loads(text)['papers']
    except (ValueError, KeyError, TypeError):
        raise SummaryError('the reply was not in the expected format')

    by_id = {p['id']: p for p in papers}
    out = []
    for pick in picks:
        p = by_id.get(re.sub(r'v\d+$', '', str(pick.get('id', '')).strip()))
        headline, summary = str(pick.get('headline', '')).strip(), str(pick.get('summary', '')).strip()
        if not p or not headline or not summary or len(summary) > 500 or any(o['id'] == p['id'] for o in out):
            continue
        topic = pick.get('topic') if pick.get('topic') in TOPICS else CATEGORY_TOPIC.get(p['category'], 'Astrophysics')
        out.append(dict(p, headline=headline[:120], summary=summary, topic=topic))
    if len(out) < 3:
        raise SummaryError('the model returned %d usable papers instead of 3' % len(out))
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

    try:
        papers, source = latest_papers()
    except Unavailable as err:
        # arXiv being down or throttling us is not worth a failure email: keep yesterday's papers
        note('warning', 'arXiv could not be reached', 'Keeping the current papers. %s' % err)
        return
    newest = max(p['id'] for p in papers)
    print('Found %d new astronomy papers (newest %s) via the %s' % (len(papers), newest, source))

    key, model = os.environ.get('ANTHROPIC_API_KEY', '').strip(), os.environ.get('CLAUDE_MODEL', '').strip() or DEFAULT_MODEL
    # Same newest papers as last time (weekends, holidays): nothing to do, unless summaries can now be added
    if previous and previous.get('newest') == newest and (previous.get('plain') or not key):
        print('No new papers since', previous.get('updated'))
        return

    plain = False
    if key:
        try:
            chosen, plain = summarise(papers, model), True
        except SummaryError as err:
            note('warning', 'Plain-language summaries failed', '%s. Showing the opening of each abstract instead.' % err)
    else:
        note('notice', 'No ANTHROPIC_API_KEY', 'Add it as a repository secret to get plain-language summaries.')
    if not plain:
        chosen = without_summaries(papers)

    feed = {
        'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'newest': newest,
        'plain': plain,
        'summarised_by': model if plain else None,
        'papers': [{k: p[k] for k in ('id', 'headline', 'summary', 'topic', 'title', 'authors', 'category', 'published', 'url')} for p in chosen],
    }
    with open(args.out, 'w') as f:
        json.dump(feed, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('Wrote', len(chosen), 'papers', '(plain summaries)' if plain else '(abstract openings)')


if __name__ == '__main__':
    try:
        main()
    except Exception as err:
        note('error', 'The research feed script failed', '%s: %s' % (type(err).__name__, err))
        raise
